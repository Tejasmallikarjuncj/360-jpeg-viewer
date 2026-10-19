const canvas=document.getElementById('view');let gl=null;
let graphicsError='';
let prog,buf,loc,uniforms,tex;
try{
gl=canvas.getContext('webgl',{antialias:false,alpha:false,preserveDrawingBuffer:false});
if(!gl)throw Error('360° graphics are unavailable. JPEGs can still open in flat view.');
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
prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vert));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error('Could not initialize viewer');gl.useProgram(prog);
buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
loc=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const uni=n=>gl.getUniformLocation(prog,n);uniforms={resolution:uni('resolution'),yaw:uni('yaw'),pitch:uni('pitch'),fov:uni('fov'),photo:uni('photo')};
tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
}catch(error){graphicsError=error.message;gl=null;}
let yaw=0,pitch=0,fov=Math.PI/2.6;
const $=id=>document.getElementById(id);
const status=$('status'), mode=$('mode');
if(graphicsError)status.textContent=graphicsError;
const mobileDevice= /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const maxDisplayPixels=mobileDevice?4*1024*1024:16*1024*1024;
let image=null, imageURL=null, request=0, frame=0, filename='', warning='';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function render(){
 frame=0;if(!image||mode.value==='flat'||!gl||gl.isContextLost())return;
 const ratio=Math.min(2,devicePixelRatio||1,Math.sqrt(maxDisplayPixels/Math.max(1,canvas.clientWidth*canvas.clientHeight))),w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 gl.viewport(0,0,w,h);gl.uniform2f(uniforms.resolution,w,h);gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.pitch,pitch);gl.uniform1f(uniforms.fov,fov);gl.uniform1i(uniforms.photo,0);gl.drawArrays(gl.TRIANGLES,0,6);
}
function redraw(){if(!frame)frame=requestAnimationFrame(render);}
function reset(){yaw=0;pitch=0;fov=Math.PI/2.6;redraw();}
function setMode(){
 if(!gl||gl.isContextLost())mode.value='flat';
 const flat=mode.value==='flat';
 if(flat&&imageURL&&$('flat').getAttribute('src')!==imageURL)$('flat').src=imageURL;
 if(!flat)$('flat').removeAttribute('src');canvas.hidden=flat;$('flat').hidden=!flat;
 for(const id of ['in','out','reset'])$(id).disabled=flat||!image;
 status.textContent=filename+(flat?' · Flat image'+(graphicsError?' · '+graphicsError:''):` · 360° panorama${warning}`);redraw();
}
async function openFile(file){
 if(!file)return;
 const version=++request;
 if(!/\.jpe?g$/i.test(file.name)&&file.type!=='image/jpeg'){status.textContent='Please choose a JPEG (.jpg or .jpeg) file.';return;}
 status.textContent='Opening '+file.name+'…';
 const url=URL.createObjectURL(file),im=new Image();
 try{
  await new Promise((resolve,reject)=>{
   im.onload=resolve;
   im.onerror=()=>reject(Error('Could not read this JPEG on this device. If it is in iCloud, download it in Files first and select it again.'));
   im.src=url;
  });
  if(version!==request){URL.revokeObjectURL(url);return;}
  if(gl&&!gl.isContextLost()){
   // Bound both dimensions and pixel area: a GPU's maximum texture size is not a memory budget.
   const max=Math.min(mobileDevice?4096:8192,gl.getParameter(gl.MAX_TEXTURE_SIZE));
   const scale=Math.min(1,max/im.naturalWidth,max/im.naturalHeight,Math.sqrt(maxDisplayPixels/(im.naturalWidth*im.naturalHeight)));
   let source=im,staging=null;
   try{
    if(scale<1){
     staging=document.createElement('canvas');staging.width=Math.max(1,Math.floor(im.naturalWidth*scale));staging.height=Math.max(1,Math.floor(im.naturalHeight*scale));
     const context=staging.getContext('2d');if(!context)throw Error('Not enough graphics memory for 360° view.');
     context.drawImage(im,0,0,staging.width,staging.height);source=staging;
    }
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
    if(gl.getError()!==gl.NO_ERROR)throw Error('Not enough graphics memory for 360° view.');
    graphicsError='';
   }catch(error){graphicsError=error.message;}
   finally{if(staging){staging.width=0;staging.height=0;}}
  }else{graphicsError='360° graphics are unavailable. Reload to retry.';}
  const previousURL=imageURL;imageURL=url;image={width:im.naturalWidth,height:im.naturalHeight};filename=file.name;
  if(previousURL)URL.revokeObjectURL(previousURL);
  const panorama=Math.abs(im.width/im.height-2)<.05;
  warning=panorama?'':' · This image is not 2:1; it may look distorted.';
  mode.value=panorama&&!graphicsError?'360':'flat';mode.querySelector('[value="360"]').disabled=!!graphicsError;mode.disabled=false;$('empty').hidden=true;reset();setMode();
 }catch(error){URL.revokeObjectURL(url);if(version===request)status.textContent=error.name==='EncodingError'?'Could not read this JPEG. Choose a valid image.':error.message;}
 finally{im.onload=null;im.onerror=null;im.removeAttribute('src');}
}
$('open').addEventListener('click',()=>{$('file').click();});
$('file').addEventListener('change',async e=>{const input=e.target;await openFile(input.files[0]);input.value='';});
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
if(typeof ResizeObserver!=='undefined')new ResizeObserver(redraw).observe(canvas);
else window.addEventListener('resize',redraw);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();graphicsError='360° graphics were interrupted. Reload to retry.';if(image){mode.value='flat';mode.querySelector('[value="360"]').disabled=true;setMode();}else status.textContent=graphicsError;});
