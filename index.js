const path = require("path");
const logger = require("./logger");
const usernameGen = require("username-generator");
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
  },
});

const SOCKET_EVENT = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnect",
  USERS_LIST: "users_list",
  REQUEST_SENT: "request_sent",
  REQUEST_ACCEPTED: "request_accepted",
  REQUEST_REJECTED: "request_rejected",
  SEND_REQUEST: "send_request",
  ACCEPT_REQUEST: "accept_request",
  REJECT_REQUEST: "reject_request",
  SERVER_FULL: "server_full",
  LEFT: "left",
};

const users = {};

// converts users into a list
const usersList = (usersObj) => {
  const list = [];
  Object.keys(usersObj).forEach((username) => {
    list.push({
      username,
      timestamp: usersObj[username].timestamp,
      imageUri: usersObj[username].imageUri,
      roomId: usersObj[username]?.roomId,
    });
  });
  return list;
};

// console log with timestamp
function Log(message, data) {
  console.log(new Date().toISOString(), message, data);
}

io.on("connection", (socket) => {
  //generate username against a socket connection and store it
  const user = socket.handshake.query.name;
  const parsedUser = JSON.parse(user);
  const username = parsedUser.name;

  if (Object.keys(users).length > 10) {
    socket.emit(SOCKET_EVENT.SERVER_FULL);
    return;
  }
  if (!users[username]) {
    users[username] = {
      id: socket.id,
      timestamp: new Date().toISOString(),
      imageUri: parsedUser.imageUri,
      roomId: parsedUser?.roomId,
    };
  }
  console.log(users);
  logger.log(SOCKET_EVENT.CONNECTED, username);
  // send back username
  socket.emit(SOCKET_EVENT.CONNECTED, username);

  // send online users list
  io.sockets.emit(SOCKET_EVENT.USERS_LIST, usersList(users));

  socket.on(SOCKET_EVENT.LEFT, () => {
    delete users[username];
    // send current users list
    io.sockets.emit(SOCKET_EVENT.USERS_LIST, usersList(users));
    Log(SOCKET_EVENT.DISCONNECTED, username);
  });

  socket.on(SOCKET_EVENT.DISCONNECTED, () => {
    // remove user from the list
    delete users[username];
    // send current users list
    io.sockets.emit(SOCKET_EVENT.USERS_LIST, usersList(users));
    Log(SOCKET_EVENT.DISCONNECTED, username);
  });

  socket.on(SOCKET_EVENT.SEND_REQUEST, ({ username, signal, to }) => {
    // tell user that a request has been sent
    io.to(users[to].id).emit(SOCKET_EVENT.REQUEST_SENT, {
      signal,
      username,
    });
    Log(SOCKET_EVENT.SEND_REQUEST, username);
  });

  socket.on(SOCKET_EVENT.ACCEPT_REQUEST, ({ signal, to }) => {
    // tell user the request has been accepted
    io.to(users[to].id).emit(SOCKET_EVENT.REQUEST_ACCEPTED, { signal });
    Log(SOCKET_EVENT.ACCEPT_REQUEST, username);
  });

  socket.on(SOCKET_EVENT.REJECT_REQUEST, ({ to }) => {
    // tell user the request has been rejected
    io.to(users[to].id).emit(SOCKET_EVENT.REQUEST_REJECTED);
    Log(SOCKET_EVENT.REJECT_REQUEST, username);
  });
});
const port = process.env.PORT || 5000;
http.listen(port);
Log("server listening on port", port);
