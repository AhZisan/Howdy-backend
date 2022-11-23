require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

app.use(bodyParser.json());
app.use(cors());

var path = require("path");
const users = {};
const socketToRoom = {};
let dataWithName = [];

io.on("connection", (socket) => {
  var room = socket.handshake["query"]["r_var"];

  socket.on("join room", (roomID) => {
    socketToRoom[socket.id] = roomID;
    if (Object.keys(socketToRoom).length > 4) {
      socket.emit("server full");
      return;
    }

    socket.join(room);
    const socketsArray = Object.keys(io.sockets.adapter.rooms[roomID].sockets);
    const partnerID = socketsArray.filter((id) => id !== socket.id);

    socket.emit("all users", partnerID);
  });
  socket.on("username", (payload) => {
    dataWithName.push(payload);
  });

  socket.emit("getusername", dataWithName);

  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("disconnect", () => {
    const roomID = socketToRoom[socket.id];

    io.in(roomID).emit("user left", roomID);
    dataWithName = dataWithName.filter((user) => user.id !== socket.id);
    let room = users[roomID];
    if (room) {
      room = room.filter((id) => id !== socket.id);
    }
    delete socketToRoom[socket.id];
  });

  socket.on("file downloaded", () => {
    socket.broadcast.emit("file recieved");
  });
});

app.get("/", (req, res) => {
  res.send("I'm alive");
});
const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`server is running on port ${port}`));
