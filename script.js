// ================= STATE =================

const state = {
  room: "title",
  sanity: 100,
  role: null,
  name: "???",
  betrayalActive: false
};

// ================= ELEMENTS =================

const bg = document.getElementById("bg");
const screen = document.getElementById("screen");
const music = document.getElementById("music");
const cursor = document.getElementById("cursor");

// ================= ASSETS =================

const A = {
  title: ["https://files.catbox.moe/3726jk.jpg","65ntst.mp3"],
  prologue: ["https://files.catbox.moe/pej4lf.jpg","jqhso7.mp3"],
  name: ["https://files.catbox.moe/kzyy85.jpg","x4p3l8.mp3"],
  test: ["https://files.catbox.moe/f5c8uy.jpg","zo3w4o.mp3"],

  classroom: ["https://files.catbox.moe/5rzhzb.jpg","iufxfv.mp3"],
  hallway: ["https://files.catbox.moe/xgx0jd.jpg","wo0ygv.mp3"],
  library: ["https://files.catbox.moe/m3gtw6.jpg","6xdkjm.mp3"],
  clock: ["https://files.catbox.moe/bgq2qf.jpg","n2esqe.mp3"],
  gate: ["https://files.catbox.moe/yw97ze.jpg","attj2c.mp3"]
};

// ================= ENGINE =================

function setScene(img, audio){
  bg.style.backgroundImage = `url(${img})`;
  music.src = audio;
  music.play();
}

function render(html){
  screen.innerHTML = html;
}

// ================= 🦋 CURSOR SYSTEM =================

// cursor follow
document.addEventListener("mousemove", (e) => {
  cursor.style.left = e.clientX + "px";
  cursor.style.top = e.clientY + "px";

  createTrail(e.clientX, e.clientY);
});

// trail spawn
function createTrail(x, y){
  const t = document.createElement("div");
  t.className = "butterfly-trail";
  t.style.left = x + "px";
  t.style.top = y + "px";
  document.body.appendChild(t);

  setTimeout(() => t.remove(), 1000);
}

// ================= SANITY =================

function changeSanity(v){
  state.sanity += v;
}

// ================= ROLE =================

function assignRole(r){
  state.role = r;
  classroom();
}

// ================= TITLE =================

function title(){
  setScene(...A.title);
  render(`<button onclick="prologue()">START</button>`);
}

// ================= PROLOGUE =================

function prologue(){
  setScene(...A.prologue);
  render(`<button onclick="nameScreen()">Continue</button>`);
}

// ================= NAME =================

function nameScreen(){
  setScene(...A.name);
  render(`
    <input id="n" placeholder="Enter name">
    <button onclick="setName()">Continue</button>
  `);
}

function setName(){
  state.name = document.getElementById("n").value || "???";
  personality();
}

// ================= PERSONALITY =================

function personality(){
  setScene(...A.test);

  render(`
    <button onclick="assignRole('wanderer')">I don't know</button>
    <button onclick="assignRole('observer')">It might</button>
    <button onclick="assignRole('betrayer')">Ignore it</button>
    <button onclick="assignRole('forgotten')">I don't have one</button>
  `);
}

// ================= CLASSROOM =================

function classroom(){
  setScene(...A.classroom);

  render(`
    <p>Classroom is in session.</p>
    <button onclick="hallway()">Leave</button>
  `);

  changeSanity(-5);
}

// ================= HALLWAY =================

function hallway(){
  setScene(...A.hallway);

  render(`
    <p>The hallway is longer than it should be.</p>
    <button onclick="library()">Continue</button>
  `);

  changeSanity(-10);
}

// ================= LIBRARY =================

function library(){
  setScene(...A.library);

  render(`
    <p>Books rewrite themselves.</p>
    <button onclick="clock()">Continue</button>
  `);

  changeSanity(-10);
}

// ================= CLOCK =================

function clock(){
  setScene(...A.clock);

  render(`
    <p>Time is broken.</p>
    <button onclick="gate()">Final Gate</button>
  `);

  changeSanity(-10);
}

// ================= FINAL GATE =================

function gate(){
  setScene(...A.gate);

  let ending = "true";

  if(state.sanity < 30) ending = "forgotten";
  if(state.role === "betrayer") ending = "betray";

  render(`
    <h2>FINAL GATE</h2>
    <button onclick="end('${ending}')">END</button>
  `);
}

// ================= END =================

function end(type){
  render(`<h1>${type.toUpperCase()} ENDING</h1><button onclick="location.reload()">Restart</button>`);
}

// ================= START =================

title();
