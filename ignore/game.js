(() => {
  'use strict';
  if (!window.THREE) {
    document.getElementById('boot').textContent = 'Three.js failed to load. Connect to the internet and refresh.';
    return;
  }

  const T = THREE;
  const rand = (a,b)=>a+Math.random()*(b-a);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const damp=(a,b,lambda,dt)=>T.MathUtils.damp(a,b,lambda,dt);
  const dist2=(a,b)=>{const dx=a.x-b.x,dz=a.z-b.z;return dx*dx+dz*dz;};

  const CFG={
    worldW:2400, worldD:1900, road:26, block:170,
    maxNPC:72, maxCars:52, maxPolice:10,
    playerSpeed:5.2, sprintSpeed:8.5,
    gravity:22, jump:8.8,
    npcSpawn:520, policeSpawn:640
  };

  const scene=new T.Scene();
  scene.background=new T.Color(0x07101b);
  scene.fog=new T.FogExp2(0x07101b,0.0009);
  const camera=new T.PerspectiveCamera(62,innerWidth/innerHeight,0.1,3000);
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
  document.getElementById('game').appendChild(renderer.domElement);

  const hemi=new T.HemisphereLight(0xcceeff,0x11111b,1.1); scene.add(hemi);
  const sun=new T.DirectionalLight(0xffb27a,2.0); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.near=10;sun.shadow.camera.far=1400;sun.shadow.camera.left=-600;sun.shadow.camera.right=600;sun.shadow.camera.top=600;sun.shadow.camera.bottom=-600; scene.add(sun);
  const moon=new T.DirectionalLight(0x4d6dff,0.12); scene.add(moon);

  const MAT={
    road:new T.MeshStandardMaterial({color:0x11151b,roughness:.96}),
    roadLine:new T.MeshBasicMaterial({color:0xf2d880}),
    sidewalk:new T.MeshStandardMaterial({color:0x4a4d55,roughness:.9}),
    grass:new T.MeshStandardMaterial({color:0x1e4b39,roughness:1}),
    water:new T.MeshStandardMaterial({color:0x0b5367,roughness:.2,metalness:.25,transparent:true,opacity:.88}),
    sand:new T.MeshStandardMaterial({color:0xc7a76a,roughness:1}),
    building:new T.MeshStandardMaterial({color:0xd9d0c0,roughness:.8}),
    concrete:new T.MeshStandardMaterial({color:0x5f6670,roughness:.95}),
    neonPink:new T.MeshStandardMaterial({color:0xff5bbd,emissive:0xff2d9e,emissiveIntensity:4}),
    neonCyan:new T.MeshStandardMaterial({color:0x6fffe2,emissive:0x42e6c7,emissiveIntensity:4}),
    neonGold:new T.MeshStandardMaterial({color:0xffd35a,emissive:0xffb53a,emissiveIntensity:3}),
    dark:new T.MeshStandardMaterial({color:0x10131a,roughness:.6}),
    chrome:new T.MeshStandardMaterial({color:0x9da5b0,metalness:.65,roughness:.28}),
    tire:new T.MeshStandardMaterial({color:0x0d0d10,roughness:1}),
    glass:new T.MeshStandardMaterial({color:0x77b8d4,transparent:true,opacity:.35,roughness:.05,metalness:.15}),
    npc:new T.MeshStandardMaterial({color:0xb6b6bd,roughness:.8})
  };

  const world=new T.Group(); scene.add(world);
  const collision=[]; const interactables=[]; const roads=[]; const lots=[]; const buildings=[]; const vehicles=[]; const npcs=[]; const police=[]; const projectiles=[]; const particles=[];
  const cityBounds={minX:-1180,maxX:1180,minZ:-900,maxZ:900};

  function box(w,h,d,mat,x,y,z,cast=true,receive=true){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=receive;world.add(m);return m;}
  function cyl(r,h,mat,x,y,z,seg=10){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;world.add(m);return m;}
  function makeRoad(x,z,w,d){const r=box(w,.1,d,MAT.road,x,.02,z,false,true); roads.push({x,z,w,d});
    for(let i=-Math.floor(w/2)+8;i<Math.floor(w/2)-4;i+=18) box(2,.11,1.2,MAT.roadLine,x+i,.08,z+0.1,false,false);
    for(let i=-Math.floor(d/2)+8;i<Math.floor(d/2)-4;i+=18) box(1.2,.11,2,MAT.roadLine,x+.1,.08,z+i,false,false);
    return r;
  }

  // Ground and coast.
  box(CFG.worldW,.2,CFG.worldD,new T.MeshStandardMaterial({color:0x26382d,roughness:1}),0,-.14,0,false,true);
  // Ocean to the south/east creates a clear coastal silhouette.
  box(720,.05,1900,MAT.water,1500,-.03,0,false,false);
  box(2400,.05,420,MAT.water,-80,-.03,1060,false,false);
  box(2400,.06,28,MAT.sand,-80,.01,860,false,false);

  // City road lattice.
  const roadXs=[-1000,-650,-300,50,400,750,1100];
  const roadZs=[-760,-430,-100,230,560];
  roadXs.forEach(x=>makeRoad(x,0,CFG.road,1650));
  roadZs.forEach(z=>makeRoad(0,z,2250,CFG.road));
  // Highway.
  box(90,.12,1700,MAT.road,900,.05,0,false,true);
  for(let z=-800;z<800;z+=30) box(3,.13,12,MAT.roadLine,900,.11,z,false,false);

  // Bridges over the waterfront cuts.
  function bridge(x,z,w,d){
    box(w,1.2,d,MAT.concrete,x,.35,z,true,true);
    for(let s=-w/2+12;s<w/2-12;s+=24) cyl(.55,8,MAT.concrete,x+s,-3,z,8);
  }
  bridge(1110,850,210,100);
  bridge(1020,640,160,80);

  // Parks and lots.
  function park(cx,cz,w,d){box(w,.12,d,MAT.grass,cx,.02,cz,false,true);for(let i=0;i<18;i++){const x=rand(cx-w/2+12,cx+w/2-12),z=rand(cz-d/2+12,cz+d/2-12);makePalm(x,z,rand(.85,1.2));}}
  function parking(cx,cz,w,d){box(w,.08,d,MAT.concrete,cx,.04,cz,false,true);for(let x=cx-w/2+8;x<cx+w/2-5;x+=12)box(.18,.09,d-12,MAT.roadLine,x,.09,cz,false,false);}
  park(-820,380,230,190); park(520,-600,230,190); parking(-540,-600,230,160); parking(550,400,260,150);

  // Buildings by district. Every building is procedural, with unique colors, rooftop details, and occasional neon.
  function makeBuilding(x,z,w,d,h,style=0){
    const cols=[0x746a77,0x746d65,0x566f77,0x7a5c63,0x4a6468,0x8a7860,0x596b82];
    const mat=new T.MeshStandardMaterial({color:cols[(style+Math.floor(x+z))%cols.length],roughness:.82});
    const b=box(w,h,d,mat,x,h/2,z,true,true); buildings.push(b); collision.push({minX:x-w/2-1,maxX:x+w/2+1,minZ:z-d/2-1,maxZ:z+d/2+1,h});
    // windows on the front and side.
    const rows=Math.max(2,Math.floor(h/8));
    const colsN=Math.max(2,Math.floor(w/10));
    for(let r=0;r<rows;r++) for(let c=0;c<colsN;c++){
      if(Math.random()<.26) continue;
      const wx=x-w/2+6+c*((w-12)/Math.max(1,colsN-1));
      const wy=5+r*((h-10)/Math.max(1,rows-1));
      const wz=z-d/2-.06;
      const win=box(2.2,3,0.12,Math.random()<.55?MAT.neonCyan:MAT.glass,wx,wy,wz,false,false);
      win.parent=world;
    }
    if(h>45 && Math.random()<.4){const signMat=[MAT.neonPink,MAT.neonCyan,MAT.neonGold][Math.floor(Math.random()*3)];const s=box(Math.min(w-8,48),5,.18,signMat,x,Math.min(h-8,48),z-d/2-.2,false,false);s.rotation.y=0;}
  }
  // Downtown dense core.
  for(let gx=-300;gx<=420;gx+=105)for(let gz=-430;gz<=230;gz+=105){
    const w=66+rand(-6,8),d=66+rand(-6,8),h=24+Math.random()*100;
    makeBuilding(gx+rand(-12,12),gz+rand(-12,12),w,d,h,Math.floor(Math.random()*5));
  }
  // Residential blocks.
  for(const zone of [[-880,-430],[-560,560],[10,560],[720,580],[-760,-60],[610,-80]]){
    const [cx,cz]=zone;
    for(let i=0;i<12;i++){const x=cx+rand(-120,120),z=cz+rand(-90,90);if(Math.abs(x)<430&&Math.abs(z)<420)continue;makeBuilding(x,z,55+rand(0,30),45+rand(0,20),14+rand(0,15),Math.floor(Math.random()*6));}
  }
  // Industrial district, airport, marina.
  for(let i=0;i<14;i++){const x=-930+((i%4)*125),z=-690+Math.floor(i/4)*110;makeBuilding(x,z,90,78,18+rand(0,16),6);}
  for(let i=0;i<10;i++){const x=750+((i%5)*90),z=650+Math.floor(i/5)*95;makeBuilding(x,z,72,58,10+rand(0,12),2);}
  // Airport terminal and runway.
  box(410,18,100,MAT.concrete,-720,9,680,true,true); box(540,.1,80,MAT.road,-720,.1,790,false,true);
  for(let z=420;z<=820;z+=32)box(4,.12,14,MAT.roadLine,-720,.16,z,false,false);
  const taxiway=box(580,.12,30,MAT.road,-720,.12,610,false,true); for(let x=-970;x<=-470;x+=28)box(9,.13,2,MAT.roadLine,x,.2,610,false,false);
  // Marina piers, boats.
  box(340,.3,200,MAT.concrete,650,.15,810,false,true); for(let i=0;i<8;i++)box(10,1.2,175,MAT.concrete,510+i*40,.2,810,false,true);

  // Palm InstancedMesh for efficient population.
  const palmGroup=new T.Group(); world.add(palmGroup);
  function palmGeometry(){
    const g=new T.Group();
    const trunk=new T.Mesh(new T.CylinderGeometry(.35,.55,12,8),new T.MeshStandardMaterial({color:0x66503b,roughness:1}));trunk.position.y=6;g.add(trunk);
    const leafMat=new T.MeshStandardMaterial({color:0x2f8f6b,roughness:1});
    for(let i=0;i<7;i++){const leaf=new T.Mesh(new T.BoxGeometry(1.1,.12,7),leafMat);leaf.position.y=12;leaf.rotation.y=i*Math.PI*2/7;leaf.rotation.z=.3;g.add(leaf);}
    return g;
  }
  const palms=[];
  for(let i=0;i<95;i++){const x=rand(-1100,1050),z=rand(-820,820);if(Math.random()<.55&&Math.abs(x)<350&&Math.abs(z)<350)continue;palms.push([x,z,rand(.75,1.25)]);}
  palms.forEach(p=>{const g=palmGeometry();g.position.set(p[0],0,p[1]);g.scale.setScalar(p[2]);palmGroup.add(g);});
  function makePalm(x,z,s){const g=palmGeometry();g.position.set(x,0,z);g.scale.setScalar(s);world.add(g);return g;}

  // Neon arches / streetlights.
  function streetlight(x,z){const pole=cyl(.14,6.5,MAT.dark,x,3.3,z,8);pole.castShadow=true;box(1.4,.18,.18,MAT.neonCyan,x,6.4,z-.05,false,false);}
  for(let x=-1050;x<=1050;x+=70){streetlight(x,-760);streetlight(x,230);}
  for(let z=-800;z<=800;z+=80){streetlight(-650,z);streetlight(750,z);}

  // Fictional store / safehouse / garage interaction points.
  const special={
    garage:{pos:new T.Vector3(-300,0,-590),label:'MIDTOWN GARAGE',cost:0},
    safehouse:{pos:new T.Vector3(560,0,-50),label:'SUNSET SAFEHOUSE',cost:3500},
    clothing:{pos:new T.Vector3(-535,0,560),label:'THREADS',cost:250},
    armory:{pos:new T.Vector3(350,0,255),label:'ARMORY',cost:1200},
    boatshop:{pos:new T.Vector3(650,0,775),label:'MARINA OUTFITTER',cost:2200}
  };
  function marker(pos,color,label){const group=new T.Group();const ring=new T.Mesh(new T.TorusGeometry(5,.45,8,28),new T.MeshBasicMaterial({color}));ring.rotation.x=Math.PI/2;group.add(ring);const beam=new T.Mesh(new T.CylinderGeometry(.25,1.2,7,12,1,true),new T.MeshBasicMaterial({color,transparent:true,opacity:.22,side:T.DoubleSide}));beam.position.y=3.5;group.add(beam);group.position.copy(pos);world.add(group);interactables.push({group,pos,label});return group;}
  marker(special.garage.pos,0x6fffe2,'Garage'); marker(special.safehouse.pos,0xff5bbd,'Safehouse'); marker(special.clothing.pos,0xffd35a,'Threads'); marker(special.armory.pos,0xff5bbd,'Armory'); marker(special.boatshop.pos,0x6fffe2,'Marina Outfitter');

  // Player.
  const player={group:new T.Group(),pos:new T.Vector3(-250,0,-200),vel:new T.Vector3(),yaw:0,pitch:-0.16,health:100,armor:50,onGround:true,enterVehicle:null,weapon:0,ammo:[12,24,6],reserve:[48,120,18],reload:0,fireCooldown:0,money:750,clothing:0,upgrade:0,suspicion:0,hiddenTime:0,respawn:new T.Vector3(-250,0,-200)};
  const playerBody=box(.8,1.7,.6,new T.MeshStandardMaterial({color:0xd7d7dc,roughness:.75}),0,1,-0.05,true,true);playerBody.parent=player.group;const head=new T.Mesh(new T.SphereGeometry(.34,14,10),new T.MeshStandardMaterial({color:0xe1b18e,roughness:.8}));head.position.set(0,2.0,0);head.castShadow=true;player.group.add(head);world.add(player.group);player.group.position.copy(player.pos);
  const weaponDefs=[{name:'COMPACT PULSE',mag:12,fire:.19,damage:28,range:110},{name:'AUTO CARBINE',mag:24,fire:.09,damage:18,range:120},{name:'ARC SHOTGUN',mag:6,fire:.7,damage:12,range:42,pellets:7}];

  // Vehicle system.
  const vehicleTypes={
    coupe:{name:'SPECTRA',color:0xb83d76,max:38,acc:15,brake:22,turn:1.9,hp:100},
    sedan:{name:'CIRRUS',color:0x3f83a6,max:31,acc:11,brake:20,turn:1.7,hp:120},
    pickup:{name:'RANGERET',color:0x9b7a4e,max:28,acc:10,brake:19,turn:1.55,hp:150},
    taxi:{name:'METRO CAB',color:0xd2b74a,max:32,acc:12,brake:21,turn:1.8,hp:110},
    police:{name:'PATROLER',color:0x263b59,max:36,acc:14,brake:23,turn:1.95,hp:160},
    van:{name:'BOXER VAN',color:0x7e8d91,max:25,acc:9,brake:18,turn:1.4,hp:140},
    boat:{name:'SKIMMER',color:0xeecf76,max:26,acc:9,brake:12,turn:1.4,hp:90}
  };
  function createVehicle(type,x,z,rot=0,isPolice=false){
    const def=vehicleTypes[type],g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;g.userData.kind=type;g.userData.speed=0;g.userData.health=def.hp;g.userData.max=def.max;g.userData.isPolice=isPolice;g.userData.aiTimer=rand(.2,2);
    const body=box(type==='van'?3.0:2.4,.7,type==='van'?5.2:4.5,new T.MeshStandardMaterial({color:def.color,roughness:.6,metalness:.15}),0,.8,0,true,true);body.parent=g;
    const cabin=box(type==='van'?2.7:2.1, type==='van'?1.5:1.0, type==='van'?2.6:2.4, MAT.glass, 0,1.55,-.05,true,true);cabin.parent=g;
    for(const sx of [-1,1])for(const sz of [-1,1]){const w=new T.Mesh(new T.CylinderGeometry(.42,.42,.26,14),MAT.tire);w.rotation.z=Math.PI/2;w.position.set(sx*(type==='van'?1.15:1.0),.42,sz*(type==='van'?1.8:1.55));w.parent=g;w.castShadow=true;}
    const frontLights=[];for(const sx of [-.75,.75]){const hl=box(.34,.18,.08,MAT.neonGold,sx,.82,2.25,false,false);hl.parent=g;frontLights.push(hl);} const red=box(1.6,.15,.08,MAT.neonPink,0,.87,-2.25,false,false);red.parent=g;
    if(type==='police'){const bar=box(1.2,.22,.32,MAT.neonCyan,0,2.15,.1,false,false);bar.parent=g;const r=box(.55,.14,.26,MAT.neonPink,-.28,2.28,.1,false,false);r.parent=g;}
    world.add(g);vehicles.push({g,type,def,driver:null,occupied:false,isPolice,ai:!isPolice&&type!=='boat',boat:type==='boat',dead:false,headlights:frontLights});return vehicles.at(-1);
  }
  const laneZ=()=>roadZs[Math.floor(Math.random()*roadZs.length)];
  const laneX=()=>roadXs[Math.floor(Math.random()*roadXs.length)];
  for(let i=0;i<CFG.maxCars;i++){const types=['coupe','sedan','pickup','taxi','van'];const t=types[i%types.length];let x=laneX()+rand(-8,8),z=rand(-780,760);if(Math.random()<.5){x=rand(-1050,1050);z=laneZ()+rand(-8,8);}createVehicle(t,x,z,Math.random()<.5?0:Math.PI);}
  // parked extras / marina boat.
  createVehicle('boat',650,850,0);createVehicle('boat',730,845,Math.PI*.94);

  // Pedestrian pool.
  const npcTypes=[0xe0a88c,0x8c6b5a,0xbba78f,0x6b4c42,0x9fc0d1];
  function newNPC(){const g=new T.Group();const torso=box(.55,1.1,.45,new T.MeshStandardMaterial({color:npcTypes[Math.floor(Math.random()*npcTypes.length)],roughness:.85}),0,.9,0,true,true);torso.parent=g;const h=new T.Mesh(new T.SphereGeometry(.25,10,8),new T.MeshStandardMaterial({color:0xd7ad89,roughness:.85}));h.position.y=1.6;h.castShadow=true;g.add(h);world.add(g);return {g,active:false,health:100,state:'wander',target:new T.Vector3(),speed:rand(1.2,2.3),panic:0,hitFlash:0};}
  for(let i=0;i<CFG.maxNPC;i++)npcs.push(newNPC());
  function placeNPC(n){
    // sample around roads or district paths.
    const nearRoad=Math.random()<.75;
    n.g.visible=true;n.active=true;n.health=100;n.state='wander';n.panic=0;n.speed=rand(1.2,2.4);
    if(nearRoad){if(Math.random()<.5)n.g.position.set(rand(-1080,1080),0,roadZs[Math.floor(Math.random()*roadZs.length)]+rand(-8,8));else n.g.position.set(roadXs[Math.floor(Math.random()*roadXs.length)]+rand(-8,8),0,rand(-780,760));}
    else n.g.position.set(rand(-1000,980),0,rand(-780,760));
    n.target.copy(n.g.position).add(new T.Vector3(rand(-80,80),0,rand(-80,80)));
  }

  // Mission system.
  const missionMarkers=[];let missionIndex=-1;let missionState='idle';let missionData=null;
  const missionDefs=[
    {name:'MIDNIGHT DELIVERY',reward:1200,time:125,start:new T.Vector3(-540,560),steps:['Pick up the sealed package at Threads.','Drive to the Marina Outfitter.','Reach the destination before time runs out.']},
    {name:'DOCKSIDE TROUBLE',reward:1750,time:0,start:new T.Vector3(650,810),steps:['Investigate the suspicious shipment.','Clear the marked troublemakers.','Return to the dock marker.']},
    {name:'THE LONG DRIVE',reward:2400,time:150,start:new T.Vector3(-300,-590),steps:['Find the marked Spectrum coupe.','Deliver it to the Midtown Garage.','Keep the vehicle above 35% integrity.']},
    {name:'HEAT WAVE',reward:3200,time:95,start:new T.Vector3(560,-50),steps:['Create enough signal to start the escape.','Lose the pursuit.','Reach the safehouse.']}
  ];
  function markerForMission(pos,color=0xffd35a){const g=new T.Group();const ring=new T.Mesh(new T.TorusGeometry(7,.65,10,32),new T.MeshBasicMaterial({color}));ring.rotation.x=Math.PI/2;g.add(ring);const stem=new T.Mesh(new T.CylinderGeometry(.22,.9,10,12,1,true),new T.MeshBasicMaterial({color,transparent:true,opacity:.2,side:T.DoubleSide}));stem.position.y=5;g.add(stem);g.position.set(pos.x,0,pos.z);world.add(g);missionMarkers.push(g);return g;}
  missionDefs.forEach(m=>markerForMission(m.start));

  function showToast(msg,ms=3000){const el=document.getElementById('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.add('hidden'),ms);}
  function save(){localStorage.setItem('neon-shores-save',JSON.stringify({money:player.money,health:100,armor:50,upgrade:player.upgrade,clothing:player.clothing,respawn:{x:player.respawn.x,z:player.respawn.z},missionIndex}));showToast('GAME SAVED');}
  function load(){try{const d=JSON.parse(localStorage.getItem('neon-shores-save')||'null');if(d){player.money=d.money??player.money;player.upgrade=d.upgrade||0;player.clothing=d.clothing||0;if(d.respawn)player.respawn.set(d.respawn.x,0,d.respawn.z);missionIndex=d.missionIndex??-1;}}catch(e){}}
  load();

  // Controls and camera.
  const keys=new Set();let pointerLocked=false;let paused=false;let cameraYaw=.2,cameraPitch=.26;
  addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.code==='Escape'){togglePause();}if(e.code==='KeyE')interact();if(e.code==='KeyR')beginReload();if(e.code==='Digit1')player.weapon=0;if(e.code==='Digit2')player.weapon=1;if(e.code==='Digit3')player.weapon=2;});
  addEventListener('keyup',e=>keys.delete(e.code));
  renderer.domElement.addEventListener('click',()=>{if(!paused&&!pointerLocked)renderer.domElement.requestPointerLock();else if(paused)togglePause();});
  document.addEventListener('pointerlockchange',()=>pointerLocked=document.pointerLockElement===renderer.domElement);
  addEventListener('mousemove',e=>{if(!pointerLocked||paused)return;cameraYaw-=e.movementX*.0024;cameraPitch-=e.movementY*.0019;cameraPitch=clamp(cameraPitch,-.3,.75);});
  document.getElementById('resume-btn').onclick=()=>togglePause(); document.getElementById('save-btn').onclick=save;document.getElementById('reset-btn').onclick=()=>{localStorage.removeItem('neon-shores-save');location.reload();};
  function togglePause(){paused=!paused;document.getElementById('pause').classList.toggle('hidden',!paused);if(!paused&&!pointerLocked)renderer.domElement.requestPointerLock();}

  // Audio.
  let audioCtx=null;
  function audioInit(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();}
  function beep(freq,dur,type='sine',vol=.035){if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);}
  renderer.domElement.addEventListener('click',()=>{try{audioInit();}catch{}});

  // Collision helpers.
  function blocked(pos,r=.7){
    if(pos.x<cityBounds.minX||pos.x>cityBounds.maxX||pos.z<cityBounds.minZ||pos.z>cityBounds.maxZ)return true;
    for(const c of collision){if(pos.x>c.minX-r&&pos.x<c.maxX+r&&pos.z>c.minZ-r&&pos.z<c.maxZ+r)return true;}
    return false;
  }
  function vehicleCollision(v){const p=v.g.position;for(const c of collision){if(p.x>c.minX-2&&p.x<c.maxX+2&&p.z>c.minZ-2&&p.z<c.maxZ+2){v.g.userData.speed*=-.3;v.g.userData.health-=Math.abs(v.g.userData.speed)*1.2;return true;}}return false;}

  function activeVehicle(){return player.enterVehicle;}
  function enterVehicle(v){player.enterVehicle=v;v.occupied=true;player.group.visible=false;cameraYaw=v.g.rotation.y;showToast('STOLE '+v.def.name+' · +1 SIGNAL');gainSuspicion(1);}
  function exitVehicle(){const v=player.enterVehicle;if(!v)return;const right=new T.Vector3(1,0,0).applyAxisAngle(new T.Vector3(0,1,0),v.g.rotation.y);let p=v.g.position.clone().addScaledVector(right,3);if(blocked(p,1))p=v.g.position.clone().addScaledVector(right,-3);player.group.position.set(p.x,0,p.z);player.group.visible=true;player.enterVehicle=null;v.occupied=false;}
  function interact(){
    if(paused)return;
    if(player.enterVehicle){exitVehicle();return;}
    const p=player.group.position;
    let closest=null,cd=18;
    for(const v of vehicles){if(v.dead||v.isPolice)continue;const d=Math.sqrt(dist2(v.g.position,p));if(d<cd){closest=v;cd=d;}}
    if(closest){enterVehicle(closest);return;}
    for(let i=0;i<missionDefs.length;i++){if(dist2(missionDefs[i].start,p)<14&&missionState==='idle'){startMission(i);return;}}
    for(const it of interactables){if(dist2(it.pos,p)<13){handleShop(it);return;}}
  }
  function handleShop(it){const p=it.pos;if(it.label==='Safehouse'){if(player.money>=special.safehouse.cost){player.money-=special.safehouse.cost;player.respawn.copy(p);save();showToast('SAFEHOUSE PURCHASED · $3500');}else showToast('SAFEHOUSE COSTS $3500');}
    else if(it.label==='Threads'){if(player.money>=special.clothing.cost){player.money-=special.clothing.cost;player.clothing=(player.clothing+1)%3;save();showToast('WARDROBE UPDATED');}else showToast('NOT ENOUGH CASH');}
    else if(it.label==='Armory'){if(player.money>=special.armory.cost){player.money-=special.armory.cost;player.upgrade++;save();showToast('WEAPON UPGRADED');}else showToast('UPGRADE COSTS $1200');}
    else if(it.label==='Marina Outfitter'){if(player.money>=special.boatshop.cost){player.money-=special.boatshop.cost;const exists=vehicles.some(v=>v.type==='boat'&&!v.occupied&&!v.dead);if(!exists)createVehicle('boat',650,845,0);save();showToast('MARINA BOAT SERVICE PAID');}else showToast('SERVICE COSTS $2200');}
    else if(it.label==='Garage'){showToast('GARAGE: store or restore a vehicle here');}
  }

  function gainSuspicion(v){player.suspicion=clamp(player.suspicion+v,0,5);player.hiddenTime=0;}
  function decaySuspicion(dt){if(player.suspicion<=0)return;if(police.some(p=>p.active&&dist2(p.g.position,player.group.position)<p.searchRadius*p.searchRadius)){player.hiddenTime=0;return;}player.hiddenTime+=dt;if(player.hiddenTime>7){player.suspicion=clamp(player.suspicion-dt*.22,0,5);if(player.suspicion<.05)player.suspicion=0;}}

  // Mission logic.
  function startMission(i){missionIndex=i;missionState='active';missionData={start:performance.now()/1000,time:missionDefs[i].time,step:0,remaining:missionDefs[i].time,enemyCount:0,targetVehicle:null,baseVehicleHp:0};
    if(i===0)missionData.deliveryTarget=new T.Vector3(735,0,740);
    if(i===2){const v=createVehicle('coupe',-80,230,Math.PI,false);v.isMission=true;missionData.targetVehicle=v;missionData.baseVehicleHp=v.g.userData.health;}
    if(i===1){missionData.enemyCount=0;for(let k=0;k<6;k++){const n=npcs.find(x=>!x.active);if(n){placeNPC(n);n.g.position.set(640+rand(-70,70),0,810+rand(-25,25));n.state='hostile';n.health=70;n.active=true;missionData.enemyCount++;}}}
    if(i===3){gainSuspicion(3);}
    updateMissionText();showToast('MISSION START: '+missionDefs[i].name,3500);
  }
  function completeMission(){const d=missionDefs[missionIndex];player.money+=d.reward;missionState='idle';missionData=null;showToast('MISSION COMPLETE · +$'+d.reward,4000);save();}
  function failMission(){missionState='idle';missionData=null;showToast('MISSION FAILED',3000);}
  function updateMission(dt){if(missionState!=='active')return;const d=missionDefs[missionIndex];if(d.time>0){missionData.remaining-=dt;if(missionData.remaining<=0){failMission();return;}}
    const p=player.group.position;
    if(missionIndex===0){if(missionData.step===0&&dist2(p,new T.Vector3(-535,0,560))<18){missionData.step=1;showToast('PACKAGE SECURED · GET TO THE MARINA');}else if(missionData.step===1&&dist2(p,missionData.deliveryTarget)<24){completeMission();}}
    else if(missionIndex===1){if(missionData.step===0&&missionData.enemyCount>0)missionData.step=1;if(missionData.step===1&&missionData.enemyCount<=0){missionData.step=2;showToast('DOCK IS CLEAR · RETURN');}if(missionData.step===2&&dist2(p,new T.Vector3(650,0,810))<28)completeMission();}
    else if(missionIndex===2){const v=missionData.targetVehicle;if(missionData.step===0&&v&&!v.occupied&&dist2(v.g.position,p)<15){enterVehicle(v);missionData.step=1;showToast('TAKE IT TO THE GARAGE');}else if(missionData.step===1&&v&&dist2(v.g.position,special.garage.pos)<24){if(v.g.userData.health>missionData.baseVehicleHp*.35){completeMission();}else failMission();}}
    else if(missionIndex===3){if(missionData.step===0&&player.suspicion>=4){missionData.step=1;showToast('POLICE ARE LOCKED ON · RUN');}else if(missionData.step===1&&player.suspicion===0){missionData.step=2;showToast('YOU LOST THE SIGNAL · GET HOME');}else if(missionData.step===2&&dist2(p,special.safehouse.pos)<24)completeMission();}
    updateMissionText();
  }
  function updateMissionText(){const box=document.getElementById('mission-box');if(missionState!=='active'){box.classList.add('hidden');return;}box.classList.remove('hidden');const d=missionDefs[missionIndex];document.getElementById('mission-name').textContent=d.name;document.getElementById('mission-timer').textContent=d.time?Math.max(0,Math.ceil(missionData.remaining))+'s':'';document.getElementById('mission-objective').textContent=d.steps[missionData.step];}

  // Shooting & particles.
  function particle(pos,color,size=.2,count=6){for(let i=0;i<count;i++){const m=new T.Mesh(new T.SphereGeometry(size*.5,6,6),new T.MeshBasicMaterial({color,transparent:true,opacity:1}));m.position.copy(pos);m.userData.life=rand(.18,.45);m.userData.vel=new T.Vector3(rand(-3,3),rand(.5,4),rand(-3,3));world.add(m);particles.push(m);}}
  const raycaster=new T.Raycaster();
  function shoot(){if(paused||player.enterVehicle)return;audioInit();const w=weaponDefs[player.weapon];if(player.reload>0||player.fireCooldown>0)return;if(player.ammo[player.weapon]<=0){beginReload();beep(160,.06,'square',.025);return;}player.ammo[player.weapon]--;player.fireCooldown=w.fire*(player.weapon===1?.85:1);beep(160+Math.random()*40,.055,'sawtooth',.045);player.group.updateMatrixWorld(true);for(const n of npcs){if(n.active&&dist2(n.g.position,player.group.position)<260){n.panic=5;n.state=n.state==='hostile'?'hostile':'panic';}}const origin=camera.getWorldPosition(new T.Vector3());const dir=new T.Vector3();camera.getWorldDirection(dir);if(w.pellets){for(let i=0;i<w.pellets;i++)fireRay(origin,dir,w.damage,w.range,0.07);}else fireRay(origin,dir,w.damage,w.range,0);particle(origin.clone().add(dir.clone().multiplyScalar(1)),0xffd35a,.32,5);gainSuspicion(.35);
  }
  function fireRay(origin,dir,damage,range,spread){const d=dir.clone();if(spread)d.x+=rand(-spread,spread),d.y+=rand(-spread,spread),d.z+=rand(-spread,spread),d.normalize();raycaster.set(origin,d);raycaster.far=range;
    let target=null,td=Infinity;for(const n of npcs){if(!n.active||n.health<=0)continue;const bp=n.g.position.clone();bp.y+=1;const dd=origin.distanceTo(bp);if(dd>range)continue;const to=bp.clone().sub(origin).normalize();if(to.dot(d)<.986)continue;const hit=rayToPoint(origin,d,bp,.8);if(hit&&dd<td){target=n;td=dd;}}
    for(const p of police){if(!p.active||p.health<=0)continue;const bp=p.g.position.clone();bp.y+=1;const dd=origin.distanceTo(bp);if(dd>range)continue;const to=bp.clone().sub(origin).normalize();if(to.dot(d)<.986)continue;if(rayToPoint(origin,d,bp,.9)&&dd<td){target=p.npcRef;td=dd;}}
    if(target){target.health-=damage*(1+player.upgrade*.18);target.panic=4;target.state='panic';particle(target.g.position.clone().add(new T.Vector3(0,1,0)),0xff5bbd,.25,8);gainSuspicion(target.state==='hostile'?0.3:1);if(target.health<=0){target.active=false;target.g.visible=false;if(target.state==='hostile'&&missionIndex===1&&missionState==='active')missionData.enemyCount--;}}
  }
  function rayToPoint(o,d,p,r){const v=p.clone().sub(o),t=v.dot(d);if(t<0)return false;const c=o.clone().addScaledVector(d,t);return c.distanceToSquared(p)<r*r;}
  function beginReload(){const w=weaponDefs[player.weapon];if(player.reload>0||player.ammo[player.weapon]>=w.mag||player.reserve[player.weapon]<=0)return;player.reload=1.2;}
  function handleFire(dt){if(keys.has('Mouse0'))shoot();}
  addEventListener('mousedown',e=>{if(e.button===0){keys.add('Mouse0');shoot();}});addEventListener('mouseup',e=>{if(e.button===0)keys.delete('Mouse0');});

  // Police support: lightweight roadblocks and an aerial search craft.
  const roadblocks=[]; let helicopter=null;
  function rebuildRoadblocks(){
    for(const r of roadblocks)world.remove(r.g);roadblocks.length=0;
    if(player.suspicion<4)return;
    const targets=[new T.Vector3(player.group.position.x,0,player.group.position.z+120),new T.Vector3(player.group.position.x,0,player.group.position.z-120)];
    for(const t of targets){const g=new T.Group();g.position.set(clamp(t.x,-1080,1080),0,clamp(t.z,-800,800));const b=box(24,1.2,2.2,MAT.neonPink,0,1,0,true,true);b.parent=g;const c=box(10,1.8,1.5,MAT.neonCyan,0,.8,0,true,true);c.rotation.y=Math.PI/2;c.parent=g;world.add(g);roadblocks.push({g});}
  }
  function updateHelicopter(dt){
    if(player.suspicion<5){if(helicopter){world.remove(helicopter.g);helicopter=null;}return;}
    if(!helicopter){const g=new T.Group();const body=box(3,1.4,6,new T.MeshStandardMaterial({color:0x273040,roughness:.55,metalness:.35}),0,0,0,true,true);body.parent=g;const canopy=box(2.4,.9,1.8,MAT.glass,0,.45,1,true,true);canopy.parent=g;const mast=box(.18,.2,9,MAT.neonCyan,0,1,0,false,false);mast.parent=g;const beam=new T.Mesh(new T.CylinderGeometry(.2,5,40,12,1,true),new T.MeshBasicMaterial({color:0xfff4bf,transparent:true,opacity:.08,side:T.DoubleSide}));beam.position.y=-20;beam.parent=g;g.position.copy(player.group.position);g.position.y=75;world.add(g);helicopter={g};}
    const target=player.enterVehicle?player.enterVehicle.g.position:player.group.position;helicopter.g.position.x=damp(helicopter.g.position.x,target.x,.7,dt);helicopter.g.position.z=damp(helicopter.g.position.z,target.z,.7,dt);helicopter.g.position.y=75+Math.sin(performance.now()*.001)*2;helicopter.g.rotation.y+=dt*.55;
  }
  let roadblockTimer=0;

  // Police units.
  function ensurePolice(){roadblockTimer-=dt;if(player.suspicion>=4&&roadblockTimer<=0){rebuildRoadblocks();roadblockTimer=5;}else if(player.suspicion<4&&roadblocks.length){rebuildRoadblocks();}updateHelicopter(dt);if(player.suspicion<1)return;const needed=Math.min(CFG.maxPolice,Math.ceil(player.suspicion*1.6));const active=police.filter(p=>p.active).length;for(let i=active;i<needed;i++){const g=new T.Group();g.position.copy(player.group.position).add(new T.Vector3(rand(-80,80),0,rand(-80,80)));const pv=createVehicle('police',g.position.x,g.position.z,Math.random()*Math.PI*2,true);const n=newNPC();n.g.visible=false;pv.driver=n;const pr={g:pv.g,veh:pv,npcRef:n,active:true,searchRadius:180+player.suspicion*80,health:pv.g.userData.health,state:'chase'};police.push(pr);}
    for(const p of police){if(!p.active)continue;p.searchRadius=180+player.suspicion*80;p.veh.g.userData.isPolice=true;}
  }
  function updatePolice(dt){for(const p of police){if(!p.active)continue;const v=p.veh;const target=player.enterVehicle?player.enterVehicle.g.position:player.group.position;const delta=target.clone().sub(v.g.position);const d=Math.hypot(delta.x,delta.z);if(player.suspicion<=0&&d>p.searchRadius){p.active=false;v.dead=true;v.g.visible=false;continue;}p.state=d<500?'chase':'search';const desired=Math.atan2(delta.x,delta.z);let err=((desired-v.g.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;v.g.rotation.y+=clamp(err,-1.8*dt,1.8*dt);v.g.userData.speed=d>20?lerp(v.g.userData.speed,v.def.max,dt*.8):lerp(v.g.userData.speed,2,dt*2);v.g.position.x+=Math.sin(v.g.rotation.y)*v.g.userData.speed*dt;v.g.position.z+=Math.cos(v.g.rotation.y)*v.g.userData.speed*dt;v.g.userData.health-=0;vehicleCollision(v);
      if(d<14){playerTakeDamage(8*dt);if(Math.random()<.012){gainSuspicion(.25);}}
    }}

  function playerTakeDamage(d){if(player.armor>0){const a=Math.min(player.armor,d*.65);player.armor-=a;d-=a;}player.health-=d;if(player.health<=0)respawn();}
  function respawn(){if(player.enterVehicle)exitVehicle();player.group.position.copy(player.respawn);player.vel.set(0,0,0);player.health=100;player.armor=50;player.suspicion=0;for(const p of police){p.active=false;p.veh.dead=true;p.veh.g.visible=false;}showToast('YOU WOKE UP AT THE SAFEHOUSE',3000);}

  function activateNPCs(){const p=player.enterVehicle?player.enterVehicle.g.position:player.group.position;for(const n of npcs){if(!n.active){if(Math.random()<.07)placeNPC(n);continue;}const d=Math.sqrt(dist2(n.g.position,p));if(d>CFG.npcSpawn){n.active=false;n.g.visible=false;continue;}
    if(n.state==='wander'){if(dist2(n.g.position,n.target)<20)n.target.set(clamp(n.g.position.x+rand(-100,100),-1050,1050),0,clamp(n.g.position.z+rand(-100,100),-800,800));}
    const target=(n.state==='panic'||n.state==='hostile')?p:n.target;const dx=target.x-n.g.position.x,dz=target.z-n.g.position.z,len=Math.hypot(dx,dz)||1;const sp=n.state==='panic'?n.speed*2.8:n.state==='hostile'?n.speed*1.4:n.speed;n.g.position.x+=dx/len*sp*dt;n.g.position.z+=dz/len*sp*dt;n.g.rotation.y=Math.atan2(dx,dz);if(blocked(n.g.position,.45)){n.g.position.x-=dx/len*sp*dt;n.g.position.z-=dz/len*sp*dt;n.target.copy(n.g.position).add(new T.Vector3(rand(-50,50),0,rand(-50,50)));}
    if(n.panic>0)n.panic-=dt;else if(n.state==='panic')n.state='wander';
  }}

  function updateVehicles(dt){for(const v of vehicles){if(v.dead||v.occupied)continue;if(v.ai&&!v.isPolice){v.g.userData.aiTimer-=dt;if(v.g.userData.aiTimer<=0){v.g.userData.aiTimer=rand(2,5);v.g.rotation.y+=(Math.random()<.5?-1:1)*Math.PI/2;}v.g.userData.speed=damp(v.g.userData.speed,6+Math.random()*8,.8,dt);v.g.position.x+=Math.sin(v.g.rotation.y)*v.g.userData.speed*dt;v.g.position.z+=Math.cos(v.g.rotation.y)*v.g.userData.speed*dt;if(v.g.position.x<-1080||v.g.position.x>1080||v.g.position.z<-820||v.g.position.z>820)v.g.rotation.y+=Math.PI;vehicleCollision(v);}}
  }

  function drive(dt){const v=player.enterVehicle;if(!v)return;const kd=keys.has('KeyW')||keys.has('ArrowUp'),kb=keys.has('KeyS')||keys.has('ArrowDown'),kl=keys.has('KeyA')||keys.has('ArrowLeft'),kr=keys.has('KeyD')||keys.has('ArrowRight');const def=v.def;const target=kd?def.max:kb?-def.max*.45:0;v.g.userData.speed=damp(v.g.userData.speed,target,kd?1.9:4.5,dt);const steer=(kr?1:0)-(kl?1:0);v.g.rotation.y+=steer*def.turn*dt*clamp(Math.abs(v.g.userData.speed)/8,0,1);const fwd=new T.Vector3(Math.sin(v.g.rotation.y),0,Math.cos(v.g.rotation.y));const next=v.g.position.clone().addScaledVector(fwd,v.g.userData.speed*dt);if(!blocked(next,1.5)){v.g.position.copy(next);}else{v.g.userData.speed*=-.28;v.g.userData.health-=Math.abs(v.g.userData.speed)*1.8;particle(v.g.position.clone().add(new T.Vector3(0,1,0)),0xffd35a,.18,5);}
    // road / offroad penalty.
    v.g.position.y=.12+Math.sin(performance.now()*.015)*.03*(Math.min(1,Math.abs(v.g.userData.speed)/def.max));
    for(const other of vehicles){if(other===v||other.dead)continue;const dd=dist2(other.g.position,v.g.position);if(dd<18){const push=v.g.position.clone().sub(other.g.position);push.y=0;const l=push.length()||1;push.multiplyScalar((18-dd)/l*0.03);v.g.position.add(push);v.g.userData.speed*=-.32;v.g.userData.health-=Math.min(18,Math.abs(v.g.userData.speed)*.45);if(!other.occupied)other.g.userData.speed*=.45;}}
    if(v.g.userData.health<=0){v.dead=true;v.g.userData.speed=0;particle(v.g.position.clone().add(new T.Vector3(0,1,0)),0xff5bbd,.35,20);showToast('VEHICLE DESTROYED');exitVehicle();}
  }

  function onFoot(dt){if(player.enterVehicle)return;let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),z=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);if(keys.has('ArrowRight'))x+=1;if(keys.has('ArrowLeft'))x-=1;if(keys.has('ArrowDown'))z+=1;if(keys.has('ArrowUp'))z-=1;const len=Math.hypot(x,z)||1;x/=len;z/=len;const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?CFG.sprintSpeed:CFG.playerSpeed;const dir=new T.Vector3(x,0,z).applyAxisAngle(new T.Vector3(0,1,0),cameraYaw);player.vel.x=damp(player.vel.x,dir.x*speed,18,dt);player.vel.z=damp(player.vel.z,dir.z*speed,18,dt);if(keys.has('Space')&&player.onGround){player.vel.y=CFG.jump;player.onGround=false;}player.vel.y-=CFG.gravity*dt;const next=player.group.position.clone().addScaledVector(player.vel,dt);if(!blocked(new T.Vector3(next.x,0,next.z),.6)){player.group.position.x=next.x;player.group.position.z=next.z;}if(next.y<=0){next.y=0;player.onGround=true;player.vel.y=0;}player.group.position.y=next.y;player.group.rotation.y=Math.atan2(dir.x,dir.z);}

  function cameraUpdate(dt){const target=player.enterVehicle?player.enterVehicle.g.position.clone().add(new T.Vector3(0,1.2,0)):player.group.position.clone().add(new T.Vector3(0,1.45,0));const dist=player.enterVehicle?8.5:6.5;const desired=target.clone().add(new T.Vector3(Math.sin(cameraYaw)*-dist,2.6+cameraPitch*2.2,Math.cos(cameraYaw)*-dist));
    // simple anti-clipping probe against world collision AABBs.
    const dir=desired.clone().sub(target);const dl=dir.length();dir.normalize();let safe=desired.clone();for(let t=0;t<dl;t+=.5){const q=target.clone().addScaledVector(dir,t);if(blocked(q,.35)){safe=target.clone().addScaledVector(dir,Math.max(1,t-.6));break;}}
    camera.position.lerp(safe,1-Math.exp(-9*dt));camera.lookAt(target);
  }

  const minimap=document.getElementById('minimap'),mm=minimap.getContext('2d');
  function drawMinimap(){const w=minimap.width,h=minimap.height;mm.clearRect(0,0,w,h);mm.fillStyle='#071019';mm.fillRect(0,0,w,h);const sx=w/(cityBounds.maxX-cityBounds.minX),sz=h/(cityBounds.maxZ-cityBounds.minZ);function px(x){return (x-cityBounds.minX)*sx}function pz(z){return h-(z-cityBounds.minZ)*sz}
    mm.strokeStyle='rgba(111,255,226,.22)';mm.lineWidth=7;for(const r of roads){if(r.w>r.d){mm.beginPath();mm.moveTo(px(r.x-r.w/2),pz(r.z));mm.lineTo(px(r.x+r.w/2),pz(r.z));mm.stroke();}else{mm.beginPath();mm.moveTo(px(r.x),pz(r.z-r.d/2));mm.lineTo(px(r.x),pz(r.z+r.d/2));mm.stroke();}}
    mm.fillStyle='rgba(20,100,120,.55)';mm.fillRect(px(1050),0,w-px(1050),h);mm.fillRect(0,0,w,pz(860));
    const p=player.enterVehicle?player.enterVehicle.g.position:player.group.position;mm.fillStyle='#fff';mm.beginPath();mm.arc(px(p.x),pz(p.z),4,0,Math.PI*2);mm.fill();
    if(missionState==='active'){const d=missionDefs[missionIndex];const step=missionData.step;let pt=step===0?d.start:missionIndex===0?missionData.deliveryTarget:missionIndex===1?new T.Vector3(650,0,810):missionIndex===2?special.garage.pos:special.safehouse.pos;mm.fillStyle='#ffd35a';mm.beginPath();mm.arc(px(pt.x),pz(pt.z),4,0,Math.PI*2);mm.fill();}
    for(const p2 of police){if(p2.active){mm.fillStyle='#ff5bbd';mm.beginPath();mm.arc(px(p2.g.position.x),pz(p2.g.position.z),3,0,Math.PI*2);mm.fill();}}
  }

  function uiUpdate(){const hp=clamp(player.health,0,100),ar=clamp(player.armor,0,50);document.getElementById('health-fill').style.width=hp+'%';document.getElementById('armor-fill').style.width=(ar/50*100)+'%';document.getElementById('health-text').textContent=Math.ceil(hp);document.getElementById('armor-text').textContent=Math.ceil(ar);document.getElementById('money').textContent='$'+Math.floor(player.money).toLocaleString();const w=weaponDefs[player.weapon];document.getElementById('weapon-name').textContent=w.name;document.getElementById('ammo').textContent=player.ammo[player.weapon]+' / '+player.reserve[player.weapon];const sig=document.getElementById('signals');sig.innerHTML='';for(let i=0;i<5;i++){const s=document.createElement('i');s.className='signal'+(player.suspicion>=i+1?' on':'');sig.appendChild(s);}const prompt=document.getElementById('prompt');let txt='';if(player.enterVehicle)txt='E — EXIT VEHICLE';else{let nearby=false;for(const v of vehicles)if(!v.dead&&!v.isPolice&&dist2(v.g.position,player.group.position)<18)nearby=true;if(nearby)txt='E — ENTER VEHICLE';for(const it of interactables)if(dist2(it.pos,player.group.position)<13)txt='E — '+it.label;if(missionState==='idle')for(const m of missionDefs)if(dist2(m.start,player.group.position)<14)txt='E — START '+m.name;}prompt.textContent=txt;prompt.classList.toggle('hidden',!txt||paused);}

  function worldClock(){const t=(performance.now()/1000)%120;const a=t/120*Math.PI*2;const daylight=clamp(Math.sin(a)*.5+.52,0.08,1);sun.position.set(Math.cos(a)*700,200+Math.sin(a)*600,-400);sun.intensity=0.25+1.9*daylight;hemi.intensity=.35+1.0*daylight;moon.intensity=.04+.22*(1-daylight);const sky=new T.Color().setHSL(.58,.5,lerp(.035,.28,daylight));scene.background.lerp(sky,.05);scene.fog.color.lerp(sky,.05);scene.fog.density=lerp(.00135,.00065,daylight);renderer.toneMappingExposure=lerp(.8,1.25,daylight);}

  let last=performance.now()/1000;
  let dt=0;
  function animate(){requestAnimationFrame(animate);const now=performance.now()/1000;dt=Math.min(.035,now-last);last=now;if(!paused){
      if(player.fireCooldown>0)player.fireCooldown-=dt;if(player.reload>0){player.reload-=dt;if(player.reload<=0){const w=weaponDefs[player.weapon],need=w.mag-player.ammo[player.weapon],take=Math.min(need,player.reserve[player.weapon]);player.ammo[player.weapon]+=take;player.reserve[player.weapon]-=take;}}
      if(player.enterVehicle)drive(dt);else onFoot(dt);
      activateNPCs();updateVehicles(dt);ensurePolice();updatePolice(dt);decaySuspicion(dt);updateMission(dt);handleFire(dt);cameraUpdate(dt);worldClock();drawMinimap();uiUpdate();
      for(let i=particles.length-1;i>=0;i--){const m=particles[i];m.userData.life-=dt;m.position.addScaledVector(m.userData.vel,dt);m.userData.vel.y-=9*dt;m.material.opacity=Math.max(0,m.userData.life/.45);if(m.userData.life<=0){world.remove(m);particles.splice(i,1);}}
    }
    renderer.render(scene,camera);
  }
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));});

  document.getElementById('hud').classList.remove('hidden');document.getElementById('boot').remove();showToast('WELCOME TO NEON SHORES · CLICK TO LOOK AROUND',4500);animate();
})();
