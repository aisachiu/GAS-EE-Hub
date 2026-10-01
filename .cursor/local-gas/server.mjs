#!/usr/bin/env node
// Local stand-in for the Apps Script web app runtime. It loads the repository
// scripts unchanged and serves doGet plus google.script.run against an
// in-memory spreadsheet so the EE Hub can be exercised without Google credentials.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

function resolveRoot() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.EE_HUB_ROOT,
    path.resolve(scriptDir, '../..'),
    '/workspace',
    process.cwd()
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'Backend.js')) && fs.existsSync(path.join(candidate, 'Index.html'))) {
      return candidate;
    }
  }
  throw new Error('Could not find the EE Hub sources. Set EE_HUB_ROOT to the repository root.');
}

const root = resolveRoot();
const port = Number(process.env.EE_HUB_PORT || 8787);
const host = process.env.EE_HUB_HOST || '0.0.0.0';
const activeEmail = process.env.EE_HUB_USER || 'dev@vsa.local';

function createSheet(name) {
  const rows = [];
  const sheet = {
    getName() { return sheet.name; },
    setName(next) { sheet.name = String(next); },
    setFrozenRows() {},
    getLastRow() {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rowHasContent(rows[index])) return index + 1;
      }
      return 0;
    },
    getLastColumn() {
      let last = 0;
      rows.forEach((row) => {
        if (!row) return;
        for (let index = row.length - 1; index >= 0; index -= 1) {
          if (cellHasContent(row[index])) {
            last = Math.max(last, index + 1);
            break;
          }
        }
      });
      return last;
    },
    getDataRange() {
      return sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 1));
    },
    getRange(row, column, numRows, numCols) {
      const height = numRows === undefined ? 1 : numRows;
      const width = numCols === undefined ? 1 : numCols;
      return {
        getValues() {
          const values = [];
          for (let r = 0; r < height; r += 1) {
            const line = [];
            for (let c = 0; c < width; c += 1) line.push(readCell(row + r, column + c));
            values.push(line);
          }
          return values;
        },
        setValues(values) {
          values.forEach((line, r) => {
            line.forEach((value, c) => writeCell(row + r, column + c, value));
          });
          return this;
        },
        setValue(value) {
          writeCell(row, column, value);
          return this;
        }
      };
    },
    deleteRow(rowNumber) {
      if (rowNumber >= 1 && rowNumber <= rows.length) rows.splice(rowNumber - 1, 1);
    }
  };
  sheet.name = name;

  function readCell(row, column) {
    const line = rows[row - 1];
    if (!line || column < 1 || column > line.length || line[column - 1] === undefined || line[column - 1] === null) return '';
    return line[column - 1];
  }

  function writeCell(row, column, value) {
    while (rows.length < row) rows.push([]);
    const line = rows[row - 1];
    while (line.length < column) line.push('');
    line[column - 1] = value;
  }

  return sheet;
}

function cellHasContent(value) {
  return value !== '' && value !== null && value !== undefined;
}

function rowHasContent(row) {
  return Array.isArray(row) && row.some(cellHasContent);
}

function createRuntime() {
  const sheets = [];
  const cacheStore = new Map();
  const scriptLock = { held: false };
  const spreadsheet = {
    getSheetByName(name) { return sheets.find((sheet) => sheet.getName() === name) || null; },
    insertSheet(name) {
      const sheet = createSheet(name);
      sheets.push(sheet);
      return sheet;
    },
    getSheets() { return sheets.slice(); }
  };

  const context = vm.createContext({
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet() { return spreadsheet; },
      getUi() {
        const menu = { addItem() { return menu; }, addToUi() {} };
        return {
          createMenu() { return menu; },
          alert() {},
          ButtonSet: { OK: 'OK', YES_NO: 'YES_NO' },
          Button: { YES: 'YES', NO: 'NO', OK: 'OK' }
        };
      }
    },
    Session: {
      getActiveUser() {
        return { getEmail() { return activeEmail; } };
      }
    },
    Utilities: {
      getUuid() { return randomUUID(); }
    },
    CacheService: {
      getScriptCache() {
        return {
          get(key) {
            const entry = cacheStore.get(key);
            if (!entry) return null;
            if (entry.expiresAt <= Date.now()) {
              cacheStore.delete(key);
              return null;
            }
            return entry.value;
          },
          put(key, value, ttlSeconds) {
            cacheStore.set(key, { value: String(value), expiresAt: Date.now() + Number(ttlSeconds || 600) * 1000 });
          },
          remove(key) { cacheStore.delete(key); }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {
            if (scriptLock.held) throw new Error('Could not obtain script lock.');
            scriptLock.held = true;
          },
          releaseLock() { scriptLock.held = false; }
        };
      }
    },
    HtmlService: {
      createHtmlOutputFromFile(name) {
        const filePath = path.join(root, `${name}.html`);
        const output = {
          title: '',
          setTitle(title) { output.title = title; return output; },
          addMetaTag() { return output; },
          getContent() {
            const bridge = `<script>
window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = {
  withSuccessHandler: function(success) {
    var handlers = { success: success, failure: function(error) { throw error; } };
    var runner = new Proxy({}, {
      get: function(_target, method) {
        if (method === 'withSuccessHandler') return function(next) { handlers.success = next; return runner; };
        if (method === 'withFailureHandler') return function(next) { handlers.failure = next; return runner; };
        return function() {
          var args = Array.prototype.slice.call(arguments);
          fetch('/rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: String(method), args: args })
          }).then(function(response) { return response.json(); }).then(function(payload) {
            if (payload && payload.ok) handlers.success(payload.result);
            else handlers.failure(new Error(payload && payload.error ? payload.error : 'Request failed'));
          }).catch(function(error) { handlers.failure(error); });
        };
      }
    });
    return runner;
  }
};
</script>`;
            return fs.readFileSync(filePath, 'utf8').replace('<body>', `<body>\n${bridge}`);
          }
        };
        return output;
      }
    }
  });

  ['Backend.js', 'Audit.js', 'PhaseRules.js', 'ActionItemEngine.js', 'Code.js'].forEach((fileName) => {
    vm.runInContext(fs.readFileSync(path.join(root, fileName), 'utf8'), context, { filename: fileName });
  });

  const staffHeaders = ['EMAIL', 'DisplayName', 'Primary Department', 'StaffCode', 'isStaff', 'isSupervisor', 'isLead', 'isCoordinator', 'isAdmin', 'EEQuota', 'EESubjects'];
  const staff = spreadsheet.insertSheet('USERS-STAFF');
  staff.getRange(1, 1, 1, staffHeaders.length).setValues([staffHeaders]);
  staff.setFrozenRows(1);
  staff.getRange(2, 1, 1, staffHeaders.length).setValues([[
    activeEmail, 'Dev Admin', 'Extended Essay', 'DEV', true, true, true, true, true, '', ''
  ]]);

  return context;
}

const context = createRuntime();

function callServer(method, args) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(method)) throw new Error('Unknown server method.');
  const type = vm.runInContext(`typeof ${method}`, context);
  if (type !== 'function') throw new Error(`Unknown server method: ${method}`);
  context.__rpcArgs = Array.isArray(args) ? args : [];
  return vm.runInContext(`${method}.apply(null, __rpcArgs)`, context);
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  response.end(payload);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/Index.html')) {
    try {
      const html = vm.runInContext('doGet().getContent()', context);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.message || String(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    try {
      sendJson(response, 200, { ok: true, user: callServer('getAppBootstrap', []).user });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message || String(error) });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/rpc') {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const result = callServer(body.method, body.args);
        sendJson(response, 200, { ok: true, result });
      } catch (error) {
        sendJson(response, 200, { ok: false, error: error.message || String(error) });
      }
    });
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

server.listen(port, host, () => {
  console.log(`VSA EE Hub listening on http://127.0.0.1:${port}`);
});
