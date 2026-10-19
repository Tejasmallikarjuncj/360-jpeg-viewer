const canvas=document.getElementById('view');let gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:false});
if(!gl){document.getElementById('status').textContent='360° mode needs WebGL. Enable hardware acceleration and reload.';throw Error('WebGL unavailable');}
const vert='attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}';
const frag=`precision highp float;
uniform vec2 resolution;uniform float yaw,pitch,fov;uniform sampler2D photo;
const float PI=3.141592653589793;
void main(){vec2 xy=(2.0*gl_FragCoord.xy-resolution)/resolution.y;
vec3 d=normalize(vec3(xy.x*tan(fov*.5),xy.y*tan(fov*.5),-1.0));
float cp=cos(pitch), sp=sin(pitch);d=vec3(d.x,cp*d.y-sp*d.z,sp*d.y+cp*d.z);
float cy=cos(yaw),sy=sin(yaw);d=vec3(cy*d.x+sy*d.z,d.y,-sy*d.x+cy*d.z);
float u=fract(0.5+atan(d.x,-d.z)/(2.*PI));float v=0.5+asin(clamp(d.y,-1.,1.))/PI;
gl_FragColor=texture2D(photo,vec2(u,1.-v));}`;
function shader(type,s){let x=gl.createShader(type);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;}
let prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vert));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error('Could not initialize viewer');gl.useProgram(prog);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
let loc=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const uni=n=>gl.getUniformLocation(prog,n);let uniforms={resolution:uni('resolution'),yaw:uni('yaw'),pitch:uni('pitch'),fov:uni('fov'),photo:uni('photo')};
let yaw=0,pitch=0,fov=Math.PI/2.6,needsRedraw=true,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
const $=id=>document.getElementById(id);
const status=$('status'), mode=$('mode');
let image=null, imageURL=null, request=0, frame=0, filename='', warning='';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function render(){
 frame=0;if(!image||mode.value==='flat'||gl.isContextLost())return;
 const ratio=Math.min(2,devicePixelRatio||1),w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 gl.viewport(0,0,w,h);gl.uniform2f(uniforms.resolution,w,h);gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.pitch,pitch);gl.uniform1f(uniforms.fov,fov);gl.uniform1i(uniforms.photo,0);gl.drawArrays(gl.TRIANGLES,0,6);
}
function redraw(){if(!frame)frame=requestAnimationFrame(render);}
function reset(){yaw=0;pitch=0;fov=Math.PI/2.6;redraw();}
function setMode(){
 const flat=mode.value==='flat';canvas.hidden=flat;$('flat').hidden=!flat;
 for(const id of ['in','out','reset'])$(id).disabled=flat||!image;
 status.textContent=filename+(flat?' · Flat image':` · 360° panorama${warning}`);redraw();
}
async function openFile(file){
 if(!file)return;
 const version=++request;
 if(!/\.jpe?g$/i.test(file.name)&&file.type!=='image/jpeg'){status.textContent='Please choose a JPEG (.jpg or .jpeg) file.';return;}
 status.textContent='Opening '+file.name+'…';
 const url=URL.createObjectURL(file),im=new Image();
 try{
  im.src=url;await im.decode();if(version!==request){URL.revokeObjectURL(url);return;}
  if(gl.isContextLost())throw Error('Graphics context lost. Reload this page to continue.');
  const max=Math.min(8192,gl.getParameter(gl.MAX_TEXTURE_SIZE));let source=im;
  if(im.width>max||im.height>max){source=document.createElement('canvas');const scale=Math.min(max/im.width,max/im.height);source.width=Math.max(1,Math.round(im.width*scale));source.height=Math.max(1,Math.round(im.height*scale));source.getContext('2d').drawImage(im,0,0,source.width,source.height);}
  gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
  if(gl.getError()!==gl.NO_ERROR)throw Error('This image could not be loaded into the viewer. Try a smaller JPEG.');
  const previousURL=imageURL;imageURL=url;image=im;filename=file.name;$('flat').src=url;
  if(previousURL)URL.revokeObjectURL(previousURL);
  const panorama=Math.abs(im.width/im.height-2)<.05;
  warning=panorama?'':' · This image is not 2:1; it may look distorted.';
  mode.value=panorama?'360':'flat';mode.disabled=false;$('empty').hidden=true;reset();setMode();
 }catch(error){URL.revokeObjectURL(url);if(version===request)status.textContent=error.name==='EncodingError'?'Could not read this JPEG. Choose a valid image.':error.message;}
}
$('file').addEventListener('change',e=>{openFile(e.target.files[0]);e.target.value='';});
const app=$('app');
for(const event of ['dragenter','dragover'])app.addEventListener(event,e=>{e.preventDefault();app.classList.add('dragover');});
app.addEventListener('dragleave',e=>{if(!app.contains(e.relatedTarget))app.classList.remove('dragover');});
app.addEventListener('drop',e=>{e.preventDefault();app.classList.remove('dragover');openFile(e.dataTransfer.files[0]);});
mode.addEventListener('change',setMode);
function zoom(delta){fov=clamp(fov+delta,.35,2.1);redraw();}
$('in').onclick=()=>zoom(-.12);$('out').onclick=()=>zoom(.12);$('reset').onclick=reset;
$('full').hidden=!document.fullscreenEnabled;
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await app.requestFullscreen();}catch{status.textContent='Fullscreen is unavailable in this browser.';}};
document.addEventListener('fullscreenchange',()=>{$('full').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';redraw();});
const pointers=new Map();
const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
canvas.addEventListener('pointerdown',e=>{if(!image||e.button>0)return;canvas.focus();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
 const last=pointers.get(e.pointerId);if(!last)return;
 const before=pointers.size===2?distance():0;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){const after=distance();if(before>0&&after>0){fov=clamp(2*Math.atan(Math.tan(fov/2)*before/after),.35,2.1);}}
 else if(pointers.size===1){const scale=fov/canvas.clientHeight;yaw+=(e.clientX-last.x)*scale;pitch=clamp(pitch+(e.clientY-last.y)*scale,-Math.PI/2,Math.PI/2);}
 redraw();
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>pointers.delete(e.pointerId));
canvas.addEventListener('wheel',e=>{if(!image)return;e.preventDefault();zoom(clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1),-150,150)*.001);},{passive:false});
canvas.addEventListener('keydown',e=>{if(!image)return;switch(e.key){case 'ArrowLeft':yaw+=.08;break;case 'ArrowRight':yaw-=.08;break;case 'ArrowUp':pitch=clamp(pitch+.08,-Math.PI/2,Math.PI/2);break;case 'ArrowDown':pitch=clamp(pitch-.08,-Math.PI/2,Math.PI/2);break;case '+':case '=':zoom(-.1);break;case '-':zoom(.1);break;case 'Home':reset();break;default:return;}e.preventDefault();redraw();});
new ResizeObserver(redraw).observe(canvas);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Graphics context lost. Reload this page to continue.';});
