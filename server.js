var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
users = [];
connections = [];
players = [];
queue = [];
dealerCards=[];
playersCards=[];
playersNames = [];
playersPuntos = [];
resultados = [];
dealerPuntos = 0;
status = 0;
turn = 0;
const MAX_WAITING = 5000;

server.listen(process.env.PORT || 3000);
console.log("Server Running");

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html')
});

io.sockets.on('connection', function(socket){

  //io.to(socket.id).emit('hand', ['ace', '2']);



  connections.push(socket);
  console.log("Connected: %s sockets connected", connections.length);




  socket.on('disconnect', function(data){
    //if(!socket.username) return;

    i=players.indexOf(socket);
    console.log("i: %s", i);

    console.log("turno: %s", turn);
    console.log("indexOf: %s", players.indexOf(socket));

    console.log('players: %s sockets connected', players.length)
    console.log('Cola: %s sockets connected', queue.length)

    users.splice(users.indexOf(socket.username), 1);
    updateUsernames();
    connections.splice(connections.indexOf(socket), 1);
    queue.splice(queue.indexOf(socket), 1);
    players.splice(i, 1);
    playersPuntos.splice(i, 1);
    resultados.splice(i, 1);

    console.log("playersCards: ", playersCards);

    playersCards.splice(i, 1);

    if(i==turn && players.length!=0){
      nextPlayer();
      console.log("salio el que le tocaba");
    }

    if(players.length==0){
      status=0;
      console.log(status);
    }

    console.log("playersCards: ", playersCards);

    console.log('players: %s', players.length)
    console.log('Cola: %s', queue.length)
    console.log('Disconnected: %s sockets connected', connections.length)

  });

  socket.on('send message', function(data){
    io.sockets.emit('new message', {msg: data, user: socket.username});
  });

  socket.on('new user', function(data, callback){

    callback(true);
    socket.username = data;
    users.push(socket.username);

    if(status==0){
      //entro a jugar un juego nuevo
      players.push(socket);
      //creo juego nuevo con los jugadores de la lista
      createNewGame();
      io.sockets.emit('entraste', 'bien');

    }else{
      //me tengo que poner a esperar otro juego
      io.to(socket.id).emit('entraste2');
      console.log("alguien se puso a la cola");
      queue.push(socket);
      console.log("largo de la cola: %s", queue.length);
    }


    updateUsernames();
  });

  socket.on('hit', function(data){
    console.log("alguien apreto hit");
    dealCard(turn);
    updatePlayers();
    //chequer no busted
    if(checkEstado(turn)==1){
      //mandar mensaje diciendo que busted
      //seguir el juego
      io.to(players[turn].id).emit('busted', {turn: turn});
      turn++;
      nextPlayer();
    }


  });

  socket.on('stick', function(data){
    console.log("alguien apreto stick");
    turn++;
    console.log("turno: %s", turn);
    nextPlayer();

  });

});

function nextPlayer(){

  if(turn>=players.length){
    //comenzar juego nuevo
    //turn=0;
    //console.log("juego nuevo")
    //createNewGame();
    //chequeo final
    chequeoFinal();
  }else{
    io.to(players[turn].id).emit('turno');
  }
};

function chequeoFinal(){
  turn=0;
  var i=0;
  while(dealerPuntos<17){
    cartas = getRandomInt(1, 11);
    tipo = getRandomInt(1, 4);
    dealerCards.push([cartas, tipo]);
    dealerPuntos=contarPuntosDealer();
    updatePlayers();
  }

  //chequear cada jugador
  for(i=0;i<playersPuntos.length;i++){
    if(dealerPuntos>21 && playersPuntos<=21){
      resultados[i]="Win";
    }
    else if(playersPuntos[i]>21){
      resultados[i]="Lose";
    }
    else if(playersPuntos[i]==dealerPuntos){
      resultados[i]="Tie";
    }
    else if(dealerPuntos<=21 && dealerPuntos>playersPuntos[i]){
      resultados[i]="Lose";
    }
    else if(dealerPuntos<=21 && dealerPuntos<playersPuntos[i]){
      resultados[i]="Win";
    }
  }
  updatePlayers();
  triggerTimeout();
};

function updateUsernames(){
  io.sockets.emit('get users', users);
};

function updatePlayers(){
  io.sockets.emit('get players', {playersNames: playersNames, cards: playersCards, dealerCards: dealerCards, playersPuntos: playersPuntos, dealerPuntos: dealerPuntos, resultados: resultados});
}

function createNewGame(){
  console.log("Juego nuevo creado");
  players = players.concat(queue);
  queue = [];
  playersCards = [];
  playersPuntos = [];
  resultados = [];
  dealerPuntos = 0;
  //console.log(players);
  status=1;
  getPlayersNames();
  updatePlayers();
  //players=connections;
  console.log("numero de jugadores: %s", players.length);
  dealerCards = [];
  cartas = getRandomInt(1, 11);
  tipo = getRandomInt(1, 4);
  dealerCards.push([cartas, tipo]);
  dealerPuntos=contarPuntosDealer();
  console.log(dealerCards);
  //console.log(players);
  playersCards = [];
  for(i=0;i<players.length;i++){
    playersCards[i]=[];
    dealCard(i);
    dealCard(i);
    //io.to(players[i].id).emit(i);
  }
  updatePlayers();
  //console.log(players[0].id);
  io.to(players[0].id).emit('turno');

};

function dealCard(user){
  cartas = getRandomInt(1, 11);
  tipo = getRandomInt(1, 4);
  playersCards[user].push([cartas, tipo]);
  console.log(playersCards);
  console.log("usuario %s",user);
  //contarPuntos(user);
  //contarPuntos(user);
  console.log("puntos: %s", contarPuntos(user));
  playersPuntos[user]=contarPuntos(user);
  console.log("playersPuntos: ", playersPuntos);


};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

function checkEstado(user){
  if(contarPuntos(user)>21){
    return 1;
  }
  else{
    return 0;
  }
}

function contarPuntosDealer(){
  var i=0;
  flag=0;
  puntos=0;
  console.log("dealercartas: ", dealerCards.length);
  for(i=0;i<dealerCards.length;i++){
    //console.log("playersCards[user][i]");
    if(dealerCards[i][0]==1){
      flag++;
      puntos += 11;
    }
    else if(dealerCards[i][0]==11 || dealerCards[i][0]==12 || dealerCards[i][0]==13 ){
      puntos += 10;
    }
    else{
      puntos += dealerCards[i][0];
    }
  }
  if(puntos>21){
    for(j=1;j<=flag;j++){
      puntos = puntos -10;
      if(puntos <= 21){
        return puntos;
      }
    }
  }
  return puntos;
}

function contarPuntos(user){
  var i=0;
  flag=0;
  puntos=0;
  console.log(playersCards[user].length);
  for(i=0;i<playersCards[user].length;i++){
    //console.log("playersCards[user][i]");
    if(playersCards[user][i][0]==1){
      flag++;
      puntos += 11;
    }
    else if(playersCards[user][i][0]==11 || playersCards[user][i][0]==12 || playersCards[user][i][0]==13 ){
      puntos += 10;
    }
    else{
      puntos += playersCards[user][i][0];
    }
  }
  if(puntos>21){
    for(j=1;j<=flag;j++){
      puntos = puntos -10;
      if(puntos <= 21){
        return puntos;
      }
    }
  }
  return puntos;
};

function getPlayersNames(){
  playersNames = [];
  for(i=0;i<players.length;i++){
    playersNames.push(players[i].username);
  }
  console.log(playersNames);
};

function triggerTimeout(){
   timeOut = setTimeout(()=>{
     createNewGame();
   },MAX_WAITING);
 }

function resetTimeOut(){
  if(typeof timeOut === 'object'){
    console.log("timeout reset");
    clearTimeout(timeOut);
  }
}
