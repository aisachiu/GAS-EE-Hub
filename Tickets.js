var TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
var TICKET_CATEGORY_CHIPS = ['c-sm', 'c-cit', 'c-eth', 'c-ext', 'c-tech'];
var TICKET_CATEGORY_DEFAULTS = [
  { name: 'Subject & Methodology', route: 'supervisor', sort: 1 },
  { name: 'Citations', route: 'supervisor', sort: 2 },
  { name: 'Ethics', route: 'coordinator', sort: 3 },
  { name: 'Extensions', route: 'coordinator', sort: 4 },
  { name: 'Technical', route: 'coordinator', sort: 5 }
];

function ticketChip_(name) {
  var known = {
    'Subject & Methodology': 'c-sm',
    'Citations': 'c-cit',
    'Ethics': 'c-eth',
    'Extensions': 'c-ext',
    'Technical': 'c-tech'
  };
  if (known[name]) return known[name];
  var hash = 0;
  var source = String(name || '');
  for (var index = 0; index < source.length; index++) hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  return TICKET_CATEGORY_CHIPS[Math.abs(hash) % TICKET_CATEGORY_CHIPS.length];
}

function seedDefaultTicketCategories_() {
  var sheet = getOrCreateManagedSheet_(APP_TABLES.ticketCategories);
  assertSheetSchema_(sheet, 'ticketCategories');
  if (sheet.getLastRow() > 1) return;
  var headers = getHeaders_(sheet);
  var rows = TICKET_CATEGORY_DEFAULTS.map(function(category) {
    var record = {
      CategoryId: Utilities.getUuid(),
      Name: category.name,
      Route: category.route,
      SortOrder: category.sort,
      Active: true
    };
    return headers.map(function(header) {
      var value = record[header];
      return typeof value === 'string' ? safeCell_(value) : value;
    });
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function readTicketCategories_() {
  seedDefaultTicketCategories_();
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.ticketCategories.sheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  assertSheetSchema_(sheet, 'ticketCategories');
  return readRecords_(sheet).map(function(record) {
    return {
      id: text_(record.CategoryId),
      name: text_(record.Name),
      route: text_(record.Route).toLowerCase(),
      sortOrder: Number(record.SortOrder) || 0,
      active: toBoolean_(record.Active)
    };
  }).filter(function(category) {
    return category.name && (category.route === 'supervisor' || category.route === 'coordinator');
  }).sort(function(left, right) {
    return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
  });
}

function ticketCategory_(name) {
  var wanted = text_(name);
  var categories = readTicketCategories_();
  for (var index = 0; index < categories.length; index++) {
    if (categories[index].active && categories[index].name === wanted) return categories[index];
  }
  return null;
}

function validateTicketCategory_(values, originalKey) {
  values.Name = text_(values.Name);
  values.Route = text_(values.Route).toLowerCase();
  if (values.Name.length > 80) throw new Error('Category name must be 80 characters or fewer.');
  if (values.Active === undefined || values.Active === '') values.Active = true;
  else values.Active = toBoolean_(values.Active);
  var key = text_(originalKey || values.CategoryId);
  readTicketCategories_().forEach(function(category) {
    if (key && category.id === key) return;
    if (category.name.toLowerCase() === values.Name.toLowerCase()) throw new Error('A ticket category with this name already exists.');
  });
}

function textHash_(value) {
  var source = String(value || '');
  var hash = 0;
  for (var index = 0; index < source.length; index++) hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  return String(hash);
}

function ticketStamp_(value) {
  if (!value) return '';
  return String(serializable_(value));
}

function readAllTickets_() {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.tickets.sheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  assertSheetSchema_(sheet, 'tickets');
  return readRecords_(sheet).map(ticketFromRecord_);
}

function ticketFromRecord_(record) {
  return {
    ticketId: text_(record.TicketId),
    studentId: normalizeEmail_(record.StudentId),
    cohort: text_(record.Cohort),
    category: text_(record.Category),
    title: text_(record.Title),
    status: text_(record.Status),
    route: text_(record.Route),
    assignee: normalizeEmail_(record.Assignee),
    createdAt: ticketStamp_(record.CreatedAt),
    lastUpdated: ticketStamp_(record.LastUpdated),
    lastActor: normalizeEmail_(record.LastActor),
    studentUnread: toBoolean_(record.StudentUnread),
    staffUnread: toBoolean_(record.StaffUnread)
  };
}

function loadTicketRaw_(ticketId) {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.tickets.sheet);
  if (!sheet) return null;
  assertSheetSchema_(sheet, 'tickets');
  return findRecordByValue_(sheet, 'TicketId', text_(ticketId));
}

function routeLabel_(ticket) {
  if (ticket.route === 'coordinator') return 'EE Coordinator';
  if (!ticket.assignee) return 'Supervisor · unassigned';
  return 'Supervisor';
}

function publicCategories_() {
  return readTicketCategories_().filter(function(item) { return item.active; }).map(function(item) {
    return { name: item.name, route: item.route, chip: ticketChip_(item.name) };
  });
}

function readPublishedFaqs_(role) {
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.faqs.sheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  assertSheetSchema_(sheet, 'faqs');
  return readRecords_(sheet).filter(function(record) {
    if (!toBoolean_(record.Published)) return false;
    var audience = text_(record.Audience).toLowerCase();
    return !audience || audience === 'all' || audience === role;
  }).map(function(record) {
    return {
      id: text_(record.FaqId),
      question: text_(record.Question),
      answer: text_(record.Answer),
      sortOrder: Number(record.SortOrder) || 0
    };
  }).sort(function(left, right) {
    return left.sortOrder - right.sortOrder || left.question.localeCompare(right.question);
  });
}

function readMessagesForTickets_(ticketIds) {
  var grouped = {};
  if (!ticketIds.length) return grouped;
  var sheet = getSpreadsheet_().getSheetByName(APP_TABLES.ticketMessages.sheet);
  if (!sheet || sheet.getLastRow() < 2) return grouped;
  assertSheetSchema_(sheet, 'ticketMessages');
  var wanted = {};
  ticketIds.forEach(function(id) { wanted[id] = true; });
  readRecords_(sheet).forEach(function(record) {
    var ticketId = text_(record.TicketId);
    if (!wanted[ticketId]) return;
    if (!grouped[ticketId]) grouped[ticketId] = [];
    grouped[ticketId].push({
      messageId: text_(record.MessageId),
      authorEmail: normalizeEmail_(record.AuthorEmail),
      authorRole: text_(record.AuthorRole),
      body: text_(record.Body),
      createdAt: ticketStamp_(record.CreatedAt)
    });
  });
  Object.keys(grouped).forEach(function(id) {
    grouped[id].sort(function(left, right) { return left.createdAt.localeCompare(right.createdAt); });
  });
  return grouped;
}

function publicMessage_(message, includeEmail) {
  var item = {
    messageId: message.messageId,
    authorRole: message.authorRole,
    body: message.body,
    createdAt: message.createdAt
  };
  if (includeEmail) item.authorEmail = message.authorEmail;
  return item;
}

function attachMessages_(tickets, includeEmail) {
  var messages = readMessagesForTickets_(tickets.map(function(ticket) { return ticket.ticketId; }));
  return tickets.map(function(ticket) {
    var copy = {};
    Object.keys(ticket).forEach(function(key) { copy[key] = ticket[key]; });
    copy.routeLabel = routeLabel_(ticket);
    copy.messages = (messages[ticket.ticketId] || []).map(function(message) {
      return publicMessage_(message, includeEmail);
    });
    return copy;
  });
}

function studentTicketNotice_(email) {
  var wanted = normalizeEmail_(email);
  var unread = readAllTickets_().filter(function(ticket) {
    return ticket.studentId === wanted && ticket.studentUnread;
  }).sort(function(left, right) { return right.lastUpdated.localeCompare(left.lastUpdated); });
  return {
    count: unread.length,
    title: unread.length ? unread[0].title : '',
    tickets: unread.slice(0, 20).map(function(ticket) {
      return { ticketId: ticket.ticketId, title: ticket.title, category: ticket.category, lastUpdated: ticket.lastUpdated };
    })
  };
}

function placementForTicket_(studentId, placements) {
  var email = normalizeEmail_(studentId);
  if (placements) return placements[email] || null;
  return findStudentPlacement_(email);
}

function staffUnreadNotices_(user, view, placements) {
  var unread = queueTickets_(user, view, placements).filter(function(ticket) { return ticket.staffUnread; });
  unread.sort(function(left, right) { return right.lastUpdated.localeCompare(left.lastUpdated); });
  return {
    count: unread.length,
    tickets: unread.slice(0, 20).map(function(ticket) {
      var placement = placementForTicket_(ticket.studentId, placements);
      return {
        ticketId: ticket.ticketId,
        title: ticket.title,
        category: ticket.category,
        displayName: placement ? placement.displayName : ticket.studentId,
        lastUpdated: ticket.lastUpdated
      };
    })
  };
}

function staffCanSeeTicket_(user, view, ticket, placements) {
  if (view === 'coordinator') {
    if (!user.permissions.canAdmin) return false;
    if (ticket.route === 'coordinator') return true;
    return ticket.route === 'supervisor' && !ticket.assignee;
  }
  if (view === 'supervisor') {
    if (!user.permissions.isSupervisor) return false;
    if (ticket.route !== 'supervisor') return false;
    if (ticket.assignee && ticket.assignee === user.email) return true;
    var placement = placementForTicket_(ticket.studentId, placements);
    return !!(placement && placement.supervisorId === user.email);
  }
  return false;
}

function queueTickets_(user, view, placements) {
  if (view !== 'supervisor' && view !== 'coordinator') return [];
  return readAllTickets_().filter(function(ticket) { return staffCanSeeTicket_(user, view, ticket, placements); });
}

function sortTickets_(tickets, unreadKey) {
  return tickets.sort(function(left, right) {
    if (!!left[unreadKey] !== !!right[unreadKey]) return left[unreadKey] ? -1 : 1;
    return right.lastUpdated.localeCompare(left.lastUpdated);
  });
}

function assertTicketFresh_(record, clientToken) {
  if (ticketStamp_(record.LastUpdated) !== String(clientToken || '')) {
    throw new Error('This ticket changed in another tab. Reload it and try again.');
  }
}

function requireTicketActor_(user, ticket, viewAs) {
  if (user.role === 'student') {
    if (ticket.studentId !== user.email) denyAccess_(user, 'VIEW_TICKET', 'Students can only open their own questions.');
    return 'student';
  }
  var view = normalizeStaffView_(user, viewAs);
  if (!staffCanSeeTicket_(user, view, ticket)) denyAccess_(user, 'VIEW_TICKET', 'This question is not in your queue.');
  return view;
}

function assertTicketActor_(user, ticket, viewAs) {
  if (user.role === 'student') {
    if (ticket.studentId !== user.email) throw new Error('You cannot update this question.');
    return;
  }
  var view = normalizeStaffView_(user, viewAs);
  if (!staffCanSeeTicket_(user, view, ticket)) throw new Error('You cannot update this question.');
}

function writeManagedRow_(entity, values, keyName) {
  var sheet = getOrCreateManagedSheet_(APP_TABLES[entity]);
  assertSheetSchema_(sheet, entity);
  var headers = getHeaders_(sheet);
  var rowNumber = keyName ? findRowNumber_(sheet, keyName, values[keyName]) : -1;
  var row = headers.map(function(header) {
    var value = values[header];
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? safeCell_(value) : value;
  });
  if (rowNumber > 0) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function ticketAudit_(ticket, extra) {
  var detail = {
    ticketId: ticket.ticketId || ticket.TicketId,
    studentId: ticket.studentId || normalizeEmail_(ticket.StudentId),
    category: ticket.category || text_(ticket.Category),
    route: ticket.route || text_(ticket.Route),
    status: ticket.status || text_(ticket.Status)
  };
  if (extra) Object.keys(extra).forEach(function(key) { detail[key] = extra[key]; });
  return detail;
}

function getTicketHub() {
  var user = requireUser_('VIEW_TICKETS');
  if (user.role !== 'student') denyAccess_(user, 'VIEW_TICKETS', 'Student access required.');
  var tickets = sortTickets_(readAllTickets_().filter(function(ticket) {
    return ticket.studentId === user.email;
  }), 'studentUnread');
  var notice = tickets.filter(function(ticket) { return ticket.studentUnread; });
  return {
    faqs: readPublishedFaqs_('student'),
    categories: publicCategories_(),
    tickets: attachMessages_(tickets, false),
    unreadCount: notice.length,
    unreadTitle: notice.length ? notice[0].title : ''
  };
}

function createTicket(payload) {
  var user = requireUser_('TICKET_CREATE');
  if (user.role !== 'student') denyAccess_(user, 'TICKET_CREATE', 'Students submit questions.');
  var input = payload || {};
  var category = ticketCategory_(input.category);
  if (!category) throw new Error('Choose a category.');
  var title = text_(input.title);
  var body = text_(input.body);
  if (!title) throw new Error('Add a short subject.');
  if (title.length > 90) throw new Error('Subject must be 90 characters or fewer.');
  if (!body) throw new Error('Write your question before sending.');
  if (body.length > 2000) throw new Error('Questions must be 2,000 characters or fewer.');
  var placement = findStudentPlacement_(user.email);
  var assignee = category.route === 'supervisor' && placement ? placement.supervisorId : '';
  var now = new Date();
  var ticketId = Utilities.getUuid();
  var record = {
    TicketId: ticketId,
    StudentId: user.email,
    Cohort: placement ? placement.cohortId : '',
    Category: category.name,
    Title: title,
    Status: 'Open',
    Route: category.route,
    Assignee: assignee || '',
    CreatedAt: now,
    LastUpdated: now,
    LastActor: user.email,
    StudentUnread: false,
    StaffUnread: true
  };
  return runAuditedMutation_(user, 'TICKET_CREATE', ticketAudit_(record, { bodyHash: textHash_(body) }), function() {
    writeManagedRow_('tickets', record, 'TicketId');
    writeManagedRow_('ticketMessages', {
      MessageId: Utilities.getUuid(),
      TicketId: ticketId,
      AuthorEmail: user.email,
      AuthorRole: 'student',
      Body: body,
      CreatedAt: now
    }, 'MessageId');
    return { ticketId: ticketId, route: category.route, routeLabel: routeLabel_(ticketFromRecord_(record)), lastUpdated: ticketStamp_(now) };
  });
}

function replyTicket(ticketId, body, lastUpdated, viewAs) {
  var user = requireUser_('TICKET_REPLY');
  var message = text_(body);
  if (!message) throw new Error('Write a message before sending.');
  if (message.length > 2000) throw new Error('Replies must be 2,000 characters or fewer.');
  var preview = loadTicketRaw_(ticketId);
  if (!preview) throw new Error('This question no longer exists.');
  requireTicketActor_(user, ticketFromRecord_(preview), viewAs);
  return runAuditedMutation_(user, 'TICKET_REPLY', ticketAudit_(preview, { bodyHash: textHash_(message) }), function() {
    var current = loadTicketRaw_(ticketId);
    if (!current) throw new Error('This question no longer exists.');
    var ticket = ticketFromRecord_(current);
    assertTicketActor_(user, ticket, viewAs);
    assertTicketFresh_(current, lastUpdated);
    var now = new Date();
    var values = {};
    getTableHeaders_('tickets').forEach(function(header) { values[header] = current[header]; });
    var status = ticket.status;
    if (user.role === 'staff' && status === 'Open') status = 'In Progress';
    values.Status = status;
    values.LastUpdated = now;
    values.LastActor = user.email;
    values.StudentUnread = user.role === 'staff';
    values.StaffUnread = user.role === 'student';
    writeManagedRow_('tickets', values, 'TicketId');
    writeManagedRow_('ticketMessages', {
      MessageId: Utilities.getUuid(),
      TicketId: ticket.ticketId,
      AuthorEmail: user.email,
      AuthorRole: user.role === 'staff' ? 'staff' : 'student',
      Body: message,
      CreatedAt: now
    }, 'MessageId');
    return { ticketId: ticket.ticketId, status: status, lastUpdated: ticketStamp_(now) };
  });
}

function setTicketStatus(ticketId, status, lastUpdated, viewAs) {
  var user = requireStaff_('TICKET_STATUS');
  var nextStatus = text_(status);
  if (TICKET_STATUSES.indexOf(nextStatus) < 0) throw new Error('Choose a valid status.');
  var preview = loadTicketRaw_(ticketId);
  if (!preview) throw new Error('This question no longer exists.');
  requireTicketActor_(user, ticketFromRecord_(preview), viewAs);
  if (text_(preview.Status) === nextStatus) {
    return { ticketId: text_(preview.TicketId), status: nextStatus, lastUpdated: ticketStamp_(preview.LastUpdated) };
  }
  return runAuditedMutation_(user, 'TICKET_STATUS', ticketAudit_(preview, { status: nextStatus }), function() {
    var current = loadTicketRaw_(ticketId);
    if (!current) throw new Error('This question no longer exists.');
    assertTicketActor_(user, ticketFromRecord_(current), viewAs);
    assertTicketFresh_(current, lastUpdated);
    var now = new Date();
    var values = {};
    getTableHeaders_('tickets').forEach(function(header) { values[header] = current[header]; });
    values.Status = nextStatus;
    values.LastUpdated = now;
    values.LastActor = user.email;
    writeManagedRow_('tickets', values, 'TicketId');
    return { ticketId: text_(current.TicketId), status: nextStatus, lastUpdated: ticketStamp_(now) };
  });
}

function markTicketRead(ticketId, lastUpdated, viewAs) {
  var user = requireUser_('TICKET_READ');
  var preview = loadTicketRaw_(ticketId);
  if (!preview) throw new Error('This question no longer exists.');
  var ticket = ticketFromRecord_(preview);
  requireTicketActor_(user, ticket, viewAs);
  var flag = user.role === 'student' ? 'StudentUnread' : 'StaffUnread';
  if (!toBoolean_(preview[flag])) return { ticketId: ticket.ticketId, lastUpdated: ticket.lastUpdated, changed: false };
  return runAuditedMutation_(user, 'TICKET_READ', ticketAudit_(preview), function() {
    var current = loadTicketRaw_(ticketId);
    if (!current) throw new Error('This question no longer exists.');
    assertTicketActor_(user, ticketFromRecord_(current), viewAs);
    assertTicketFresh_(current, lastUpdated);
    if (!toBoolean_(current[flag])) return { ticketId: text_(current.TicketId), lastUpdated: ticketStamp_(current.LastUpdated), changed: false };
    var now = new Date();
    var values = {};
    getTableHeaders_('tickets').forEach(function(header) { values[header] = current[header]; });
    values[flag] = false;
    values.LastUpdated = now;
    values.LastActor = user.email;
    writeManagedRow_('tickets', values, 'TicketId');
    return { ticketId: text_(current.TicketId), lastUpdated: ticketStamp_(now), changed: true };
  });
}

function getStaffTickets(viewAs) {
  var user = requireStaff_('VIEW_TICKETS');
  var view = normalizeStaffView_(user, viewAs);
  var tickets = sortTickets_(queueTickets_(user, view), 'staffUnread');
  var named = attachMessages_(tickets, true).map(function(ticket) {
    var placement = findStudentPlacement_(ticket.studentId);
    ticket.displayName = placement ? placement.displayName : ticket.studentId;
    return ticket;
  });
  return {
    viewAs: view,
    tickets: named,
    unreadCount: named.filter(function(ticket) { return ticket.staffUnread; }).length,
    categories: publicCategories_()
  };
}

function getStaffTicketBadge(viewAs) {
  var user = requireStaff_('VIEW_TICKETS');
  var view = normalizeStaffView_(user, viewAs);
  var unread = queueTickets_(user, view).filter(function(ticket) { return ticket.staffUnread; }).length;
  return { viewAs: view, unreadCount: unread };
}

function seedDefaultFaqs_() {
  var sheet = getOrCreateManagedSheet_(APP_TABLES.faqs);
  assertSheetSchema_(sheet, 'faqs');
  if (sheet.getLastRow() > 1) return;
  var headers = getHeaders_(sheet);
  var faqs = [
    ['How do I write a focused research question?', 'Name the subject, a specific case or text, and a question you can answer in 4,000 words. Avoid yes-or-no questions and questions that try to cover a whole discipline. Your supervisor can help you narrow it.', 1],
    ['What counts toward the 4,000-word limit?', 'The introduction, body, conclusion, and quotations count. Contents pages, maps, charts, diagrams, tables, equations, citations, the bibliography, and appendices do not. Check the current IB guide with your supervisor before you submit.', 2],
    ['Can I use AI tools in my EE?', 'AI tools can help you understand a source or check language. They cannot write the essay or invent sources. Record how you used them in the RPPF and follow the school academic honesty policy. Ask your supervisor or the EE Coordinator if you are unsure.', 3]
  ];
  var rows = faqs.map(function(faq) {
    var record = { FaqId: Utilities.getUuid(), Question: faq[0], Answer: faq[1], Audience: 'student', Published: true, SortOrder: faq[2] };
    return headers.map(function(header) {
      var value = record[header];
      return typeof value === 'string' ? safeCell_(value) : value;
    });
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
