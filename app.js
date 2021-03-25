const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 4001;
const index = require("./routes/index");
const drawWords = require("./wordsDoc/drawWords")

const app = express();
app.use(index);

const server = http.createServer(app);

const io = socketIo(server);

let interval;
let gameState = []
let players = []
let drawChat = []

function GetRoomInfo (roomID){
	let room = []
	for (let index = 0; index < players.length; index++) {
		if (players[index].roomID == roomID){
			room.push(players[index])
		}	
	}
	return room
}

function GetRoomID (socketID){
	for (let index = 0; index < players.length; index++) {
		if (players[index].socketID == socketID){
			return players[index].roomID
		}	
	}
	return 0
}

function GetSocketName (socketID){
	for (let index = 0; index < players.length; index++) {
		if (players[index].socketID == socketID){
			return players[index].name
		}	
	}
	return 0
}

function GetSocketData (socketID){
	for (let index = 0; index < players.length; index++) {
		if (players[index].socketID == socketID){
			return players[index]
		}	
	}
	return 0
}

function GetRoomLength (roomID){
	let length = 0
	for (let index = 0; index < players.length; index++) {
		if (players[index].roomID == roomID){
			length++
		}	
	}
	return length
}

function GetRoomGameState(roomID){
	for (let index = 0; index < gameState.length; index++) {
		if (gameState[index].roomID == roomID){
			return gameState[index]
		}	
	}
}

function ModifyRoomGameStateWord(roomID, word){
	for (let index = 0; index < gameState.length; index++) {
		if (gameState[index].roomID == roomID){
			gameState[index].word = word;
		}	
	}
}

function ErasePlayer (socketID){
	for (let index = 0; index < players.length; index++){
		if (players[index].socketID == socketID){
			players.splice(index, 1);
		}
	}
}

function GetPlayerArray (socketID){
	for (let index = 0; index < players.length; index++){
		if (players[index].socketID == socketID){
			return players[index]
		}
	}
	return 0
}

function GetDrawChatContentRoom (roomID){
	let drawChatContent = []
	for (let index = 0; index < drawChat.length; index++) {
		if (drawChat[index].roomID == roomID){
			drawChatContent.push(drawChat[index])
		}	
	}
	return drawChatContent
}

function SetIsMyTurn(index, roomID, state=true){
	for (let i = 0; i < players.length; i++) {
		if (players[i].roomID == roomID && players[i].priority == index){
			console.log("my turn", players[i])
			players[i].isMyTurn = state;
			console.log("my turn", players[i])

		}
	}
}

io.on("connection", (socket) => {
	socket.on("create-room", function (info){
		let player = {
			roomID : socket.id, 
			socketID : socket.id, 
			name : info[0], 
			charIndex : info[1], 
			isAdmin : info[2],
			points: 0,
			isMyTurn : false,
			priority: 0,
		}
		players.push(player)
		socket.emit("basicInfo", {roomID: socket.id, socketID: socket.id})
	})

	socket.on("request-join", function (info) {
		socket.leave(socket.id)
		socket.join(info[0])
		let player = {
			roomID : info[0],
			socketID : socket.id, 
			name : info[1], 
			charIndex : info[2], 
			isAdmin : info[3],
			points: 0,
			isMyTurn : false,
			priority: GetRoomLength(info[0])
		}
		players.push(player)
		socket.emit("basicInfo", {roomID: info[0], socketID: socket.id})
		io.to(info[0]).emit('GetRoomInfo', GetRoomInfo(info[0]))
	})

	socket.on("check-for-room", function(info, callback){
		const checkRoom = GetRoomInfo(info[0])
		if (checkRoom.length <= 0 || checkRoom.length >= 4){
			setTimeout(function(){callback(false)}, 1500);
			socket.disconnect(true)
		}

		setTimeout(function(){
			callback(true)
		}, 1500);
	})

	socket.on("GetRoomInfo", function(roomID){
		if (!roomID || roomID == '')
			roomID = socket.id

		io.to(roomID).emit('GetRoomInfo', GetRoomInfo(roomID))
		//socket.emit('GetRoomInfo', {roomInfo:GetRoomInfo(roomID), socketData: })
	})

	socket.on('GetMyData', function(callback) {
		callback(GetSocketData(socket.id))
	})

	socket.on("startGame", () => {
		let newState = {
			roomID: socket.id,
			game: 1,
			round: 0,
			word: '',
		}
		gameState.push(newState)
		let tmp = GetRoomInfo(socket.id)
		let tmpState = GetRoomGameState(socket.id)
		for (let index = 0; index < tmp.length; index++){
			if (tmp[index].priority == tmpState.round){
				SetIsMyTurn(index, socket.id)
			}
		}
		io.to(socket.id).emit("startDrawRoom")
	})

	socket.on('drawing', (data) => {
		io.to(socket.id).emit('drawing', data)
	});

	socket.on('drawChatInput', (data) =>{

		const tmp = GetRoomGameState(GetRoomID(socket.id))

		if (tmp.word == data){
			data = `${GetSocketName(socket.id)} a trouvé le mot !`
		}

		let chat = {
			roomID: GetRoomID(socket.id),
			socketID: socket.id,
			content: data,
			name: GetSocketName(socket.id),
		}
		drawChat.push(chat)

		io.to(GetRoomID(socket.id)).emit('getDrawChatContent', GetDrawChatContentRoom(GetRoomID(socket.id)))
	})

	socket.on('getWord', function(callback) {

		callback({first:drawWords.getRandomWord(), second:drawWords.getRandomWord()})
	})

	socket.on('choosenWord', (data)=>{
		ModifyRoomGameStateWord(GetRoomID(socket.id), data)
		io.to(GetRoomID(socket.id)).emit('choosenWord', data)
		socket.emit('myTurnToDraw', GetSocketData(socket.id))
	})

	socket.on('startClockDraw', () =>{
		let counter = 30;
		let timer = setInterval(()=>{
			io.to(GetRoomID(socket.id)).emit('drawTime', counter);
		  	counter--
		  	if (counter < 0) {
				clearInterval(timer);
				let tmp = GetRoomInfo(socket.id)
				let tmpState = GetRoomGameState(socket.id)
				console.log(tmpState)
				for (let index = 0; index < tmp.length; index++){
					if (tmp[index].priority == tmpState.round){
						SetIsMyTurn(index, GetRoomID(socket.id), false)
					}
				}
				io.to(GetRoomID(socket.id)).emit('drawTimeOver');
		  	}
		}, 1000);
	  });


	socket.on("disconnect", () => {
		let playerArray = GetPlayerArray(socket.id)
		console.log("client disconnected");
		console.log(playerArray.roomID)
		ErasePlayer(socket.id)
		io.to(playerArray.roomID).emit('GetRoomInfo', GetRoomInfo(playerArray.roomID))
		sendDisconnect(socket)
		console.log(socket.id)
		console.log(playerArray[0])

	});

	socket.on("Quit", (name) => {
		socket.emit("Quit")
		console.log(name + " has quit");
		socket.disconnect(true)
	})
});

io.on("Quit", (socket) => {
	socket.emit("Quit")
	console.log("client quit");
	socket.disconnect(true)
})

io.on("creation", (socket) => {
	console.log("New client");
	if (interval)
		clearInterval(interval);

	interval = setInterval(() => getApiAndEmit(socket), 1000);
	socket.on("disconnect", () => {
		console.log("client disconnected");
		clearInterval(interval);
	});
});

const sendDisconnect = socket => {
	socket.emit("FromAPI", "disconnected")
}

const getApiAndEmit = socket => {
	const response = new Date();

	socket.emit("FromAPI", response);
}

server.listen(port, () => console.log(`Server listening on port ${port}`));

//end
