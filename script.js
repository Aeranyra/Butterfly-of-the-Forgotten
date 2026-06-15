
/* =========================
   PLAYER SYSTEM
========================= */

let playerName = "";

/* CORE PSYCHOLOGY VARIABLES */
let sanity = 100;

let trust = 0;
let fear = 0;
let escape = 0;
let observation = 0;

/* PERSONALITY */
let personality = null;

/* DOM */
const bg = document.getElementById("bg");
const title = document.getElementById("title");
const text = document.getElementById("text");
const choices = document.getElementById("choices");
const inputBox = document.getElementById("inputBox");
const music = document.getElementById("music");
const letter = document.getElementById("letter");

/* =========================
   SCENES (FULL LOCKED FLOW)
========================= */

const scenes = {

title:{
t:"Butterfly of the Forgotten",
text:"You wake within an academy that should not exist.",
img:"https://files.catbox.moe/3726jk.jpg",
music:"https://files.catbox.moe/65ntst.mp3",
next:"name"
},

name:{
t:"Unknown",
text:"What is your name?",
img:"https://files.catbox.moe/kzyy85.jpg",
music:"https://files.catbox.moe/x4p3l8.mp3",
input:true
},

prologue:{
t:"Prologue",
text:"Where am I… I shouldn’t be here.",
img:"https://files.catbox.moe/pej4lf.jpg",
music:"https://files.catbox.moe/jqhso7.mp3",
next:"personality"
},

/* PERSONALITY TEST (REAL IMPACT) */
personality:{
t:"Assessment",
text:"Answer without hesitation.",
img:"https://files.catbox.moe/f5c8uy.jpg",
music:"https://files.catbox.moe/zo3w4o.mp3",
choices:[
{t:"I want to escape", effect:"escape"},
{t:"I don’t trust anyone", effect:"fear"},
{t:"I want answers", effect:"observation"},
{t:"I will survive no matter what", effect:"trust"},
],
next:"classroom"
},

classroom:{
t:"Classroom",
text:"The students already know you.",
img:"https://files.catbox.moe/5rzhzb.jpg",
music:"https://files.catbox.moe/iufxfv.mp3",
choices:[
{t:"Observe silently", effect:"observation"},
{t:"Talk to them", effect:"trust"}
],
next:"hallway"
},

hallway:{
t:"Hallway",
text:"The corridor feels unstable.",
img:"https://files.catbox.moe/xgx0jd.jpg",
music:"https://files.catbox.moe/wo0ygv.mp3",
choices:[
{t:"Move quickly", effect:"escape"},
{t:"Stay alert", effect:"fear"}
],
next:"library"
},

library:{
t:"Library",
text:"Books react to your presence.",
img:"https://files.catbox.moe/m3gtw6.jpg",
music:"https://files.catbox.moe/6xdkjm.mp3",
choices:[
{t:"Search deeper", effect:"observation"},
{t:"Leave immediately", effect:"escape"}
],
next:"clock"
},

clock:{
t:"Clock Tower",
text:"Time does not match memory.",
img:"https://files.catbox.moe/bgq2qf.jpg",
music:"https://files.catbox.moe/n2esqe.mp3",
choices:[
{t:"Analyze structure", effect:"observation"},
{t:"Ignore and proceed", effect:"escape"}
],
next:"gate"
},

gate:{
t:"Final Gate",
text:"Everything leads here.",
img:"https://files.catbox.moe/yw97ze.jpg",
music:"https://files.catbox.moe/attj2c.mp3",
next:"ending"
},

ending:{
t:"End",
text:"The academy is deciding what you were.",
img:"https://files.catbox.moe/atorqo.jpg",
music:"https://files.catbox.moe/8aia7g.mp3"
}

};

/* =========================
   ENGINE
========================= */

let current="title";

function load(key){

const s=scenes[key];
current=key;

bg.style.backgroundImage=`url(${s.img})`;
title.innerText=s.t;
type(s.text);

music.src=s.music;
music.play();

choices.innerHTML="";
inputBox.style.display=s.input?"block":"none";

if(s.next){
addChoice("Continue",s.next);
}else if(key==="ending"){
resolveEnding();
}

if(s.choices){
s.choices.forEach(c=>{
addChoice(c.t, s.next, c.effect);
});
}
}

function addChoice(text,next,effect){
const d=document.createElement("div");
d.className="choice";
d.innerText=text;
d.onclick=()=>{

if(effect){
applyEffect(effect);
}

load(next);
};
choices.appendChild(d);
}

/* =========================
   PSYCHOLOGY SYSTEM
========================= */

function applyEffect(e){
if(e==="trust") trust++;
if(e==="fear") fear++;
if(e==="escape") escape++;
if(e==="observation") observation++;

sanity -= (fear * 2);
}

/* =========================
   NAME
========================= */

function submitName(){
playerName=document.getElementById("nameInput").value||"Unknown";
load("prologue");
}

/* =========================
   TYPEWRITER
========================= */

function type(txt){
text.innerHTML="";
let i=0;
function run(){
if(i<txt.length){
text.innerHTML+=txt[i++];
setTimeout(run,20);
}
}
run();
}

/* =========================
   PERSONALITY SET
========================= */

function setPersonality(){
if(escape>trust && escape>fear && escape>observation){
personality="wanderer";
}
else if(fear>escape){
personality="distrust";
}
else if(observation>escape){
personality="observer";
}
else{
personality="fragile";
}
}

/* =========================
   ENDING ENGINE (NO RANDOM)
========================= */

function resolveEnding(){

setPersonality();

let ending;

/* FORGOTTEN */
if(sanity<=30){
ending = "forgotten";
}

/* OBSERVER ROUTE */
else if(personality==="observer"){
if(observation>3){
ending="observer_escape";
}else{
ending="observer_stay";
}
}

/* WANDERER ESCAPE */
else if(personality==="wanderer" && escape>trust){
ending="true_escape";
}

/* DISTORTION */
else if(fear>trust){
ending="betrayal";
}

/* BALANCED SECRET */
else if(trust===observation){
ending="secret";
}

/* DEFAULT */
else{
ending="betrayal";
}

showEnding(ending);
}

/* =========================
   ENDING DISPLAY
========================= */

const endings = {

true_escape:{
msg:[
"You escaped.",
"But the academy disagrees."
],
letter:[
"Your exit exists in multiple records.",
"We cannot confirm which is real."
]
},

betrayal:{
msg:[
"No betrayal occurred.",
"Only mismatched perception."
],
letter:[
"Intent was never recorded.",
"Only interpretation."
]
},

forgotten:{
msg:[
"You are no longer tracked.",
"Presence ended."
],
letter:[
"Your name still appears in old logs.",
"No one removed it."
]
},

observer_escape:{
msg:[
"You left aware.",
"Clarity is not supported outside."
],
letter:[
"You will be reassigned again."
]
},

observer_stay:{
msg:[
"You became reference.",
"Not participant."
],
letter:[
"You define stability now."
]
},

secret:{
msg:[
"This was never hidden.",
"You just reached alignment."
],
letter:[
"The academy is complete through you."
]
}

};

function showEnding(key){

const e=endings[key];

text.innerHTML=e.msg.join("<br><br>");

setTimeout(()=>{
showLetter(e.letter);
},2500);
}

/* =========================
   UNFOLD LETTER
========================= */

function showLetter(lines){
letter.style.display="block";
letter.innerHTML="";

let i=0;
function next(){
if(i<lines.length){
letter.innerHTML+=lines[i]+"<br>";
i++;
setTimeout(next,1200);
}
}
next();
}

/* START */
load("title");
