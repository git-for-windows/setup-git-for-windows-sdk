/*
This ensures that the PATH of the machine that the tests are running on,
doesn't leak into our tests.
*/
process.env.PATH = ''
