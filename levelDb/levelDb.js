const { Level } = require('level');

const localDb = new Level('localDb', { valueEncoding: 'json' });

exports.localDb = localDb;
