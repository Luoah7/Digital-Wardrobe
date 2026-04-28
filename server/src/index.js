const { createServer } = require('./server');

const port = Number(process.env.PORT || 3000);

const server = createServer();

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Digital Wardrobe API listening on http://127.0.0.1:${port}`);
});
