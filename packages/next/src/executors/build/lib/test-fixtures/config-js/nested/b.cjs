require('./a'); // Circular dependency should be handled
require('../nested.c'); // one level up
module.exports = {};
