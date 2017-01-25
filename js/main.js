var app;
var standardMaterial;
var params = {
  projection: 'normal',
  background: false,
  exposure: 0.86,
  bloomStrength: 1.7,
  bloomThreshold: 0.12,
  bloomRadius: 0.27,
  autoRotate:false,
  lineColor:'#3a5098',
  lineOpacity:0.25,
  roughness:1.0,
  bumpScale:-0.05,
  travelSpeed:0
};
$(document).ready(function(){
  app = new Sounds();
})
var Sounds = function(){
  var _this = this;
  this.waveType = 'sine';
  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000000 );
  this.camera.position.setY(500)
  //this.scene.add(new THREE.AxisHelper());
  this.controls = new THREE.OrbitControls(this.camera);
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize( window.innerWidth, window.innerHeight );
  this.renderScene = new THREE.RenderPass(this.scene, this.camera);
  // renderScene.clear = true;
  this.effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
  this.effectFXAA.uniforms['resolution'].value.set( 1 / window.innerWidth,  1 / window.innerHeight );

  this.copyShader = new THREE.ShaderPass(THREE.CopyShader);
  this.copyShader.renderToScreen = true;

  this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);//1.0, 9, 0.5, 512);
  this.bloomPass.strength = params.bloomStrength;
  this.bloomPass.radius = params.bloomRadius;
  this.bloomPass.threshold = params.bloomThreshold;
  this.composer = new THREE.EffectComposer(this.renderer);
  this.composer.setSize(window.innerWidth, window.innerHeight);
  this.composer.addPass(this.renderScene);
  this.composer.addPass(this.effectFXAA);
  this.composer.addPass(this.bloomPass);
  this.composer.addPass(this.copyShader);
  //renderer.toneMapping = THREE.ReinhardToneMapping;
  this.renderer.gammaInput = true;
  this.renderer.gammaOutput = true;
  this.renderer.setPixelRatio( window.devicePixelRatio );
  this.renderer.shadowMap.enabled = true;
  this.renderer.toneMapping = THREE.LinearToneMapping;
  //lights
  this.scene.add( new THREE.AmbientLight( 0x222222 ) );
  this.rad = 2.5;
  this.spotLight = new THREE.SpotLight( 0xffffff );
  this.spotLight.position.set( 50, 100, 50 );
  this.spotLight.angle = Math.PI;//Math.PI / 7;
  this.spotLight.penumbra = 0.8;
  this.spotLight.castShadow = true;
  this.scene.add( this.spotLight );

  standardMaterial = new THREE.MeshStandardMaterial( {
    map: null,
    color: 0x666666,
    metalness: 1.0,
    shading: THREE.SmoothShading
  } );
  this.standardMaterial = standardMaterial;
  this.textureUpdateTargets = [];
  this.lastIntersectionNull = false;
  
  var textureLoader = new THREE.TextureLoader();
  textureLoader.load( "./textures/cells.png", function( map ) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 2;
    map.repeat.set( 4, 4 );
    standardMaterial.roughnessMap = map;
    standardMaterial.bumpMap = map;
    standardMaterial.needsUpdate = true;
    _this.roughnessMap = map;
  } );

  var genCubeUrls = function( prefix, postfix ) {
    return [
      prefix + 'px' + postfix, prefix + 'nx' + postfix,
      prefix + 'py' + postfix, prefix + 'ny' + postfix,
      prefix + 'pz' + postfix, prefix + 'nz' + postfix
    ];
  };

  var hdrUrls = genCubeUrls( "./textures/", ".hdr" );
  new THREE.HDRCubeTextureLoader().load( THREE.UnsignedByteType, hdrUrls, function ( hdrCubeMap ) {

    var pmremGenerator = new THREE.PMREMGenerator( hdrCubeMap );
    pmremGenerator.update( _this.renderer );

    var pmremCubeUVPacker = new THREE.PMREMCubeUVPacker( pmremGenerator.cubeLods );
    pmremCubeUVPacker.update( _this.renderer );

    _this.hdrCubeRenderTarget = pmremCubeUVPacker.CubeUVRenderTarget;

  } );

  document.body.appendChild( this.renderer.domElement );
  this.render();
  var gui = new dat.GUI();
  gui.add( params, 'exposure', 0.1, 2.0 );
  gui.add( params, 'bloomThreshold', 0.0, 1.0 ).onChange( function(value) {
      _this.bloomPass.threshold = Number(value);
  });
  gui.add( params, 'bloomStrength', 0.0, 3.0 ).onChange( function(value) {
      _this.bloomPass.strength = Number(value);
  });
  gui.add( params, 'bloomRadius', 0.0, 1.0 ).onChange( function(value) {
      _this.bloomPass.radius = Number(value);
  });
  gui.add( params, 'autoRotate').onChange(function(value){
    params.autoRotate = value;
    _this.controls.autoRotate = value;
  })
  
  gui.close()
  // create web audio api context
  this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  this.mainVolume = this.audioCtx.createGain();
  
  this.mainVolume.connect(this.audioCtx.destination)

  var scale = 0.0783;//scaled schumann for low tone group
  var highscale = 0.338;//scaled schumann for high tone group
  var num = 7.83; //schumann fundamental: https://en.wikipedia.org/wiki/Schumann_resonances
  num = num - (num*0.11);
  var scaleValues = [174,285,396,417,528,639,741,852,963];//solfeggio scales
  scaleValues = scaleValues.concat([174-num,285-num,396-num,417-num,528-num,639-num,741-num,852-num,963-num])//give it a little more grit to the ears with +/- 11% of schumann fundamental
  scaleValues = scaleValues.concat([174+num,285+num,396+num,417+num,528+num,639+num,741+num,852+num,963+num])//give it a little more grit to the ears with +/- 11% of schumann fundamental
  
  _this.A_Waves = new THREE.Object3D();
  _this.B_Waves = new THREE.Object3D();
  _this.scene.add(_this.A_Waves,_this.B_Waves);
  for(i=1;i<=scaleValues.length;i++){
    var ii = i-1;
    var freq = scaleValues[ii];
    var v = freq*scale-(freq*scale*0.11);
    var v2 = freq*highscale-(freq*highscale*0.11);
    this.createPair(v,num*scale,i/scaleValues.length);
    this.createPair(v2,num*highscale,i/scaleValues.length);
  }
  
}
Sounds.prototype.createPair = function(frequency,diff,deg){
  var sound1Material = new THREE.MeshBasicMaterial({color:0x666699,wireframe:true,opacity:0.5,transparent:true});
  var sound2Material = new THREE.MeshBasicMaterial({color:0x666699,wireframe:true,opacity:0.5,transparent:true});
  
  var soundGeo = new THREE.IcosahedronGeometry(2,2);

  var _this = this;
  var sound1 = {
    oscillator:this.audioCtx.createOscillator(),
    volume: this.audioCtx.createGain(),
  };
  sound1.oscillator.type = this.waveType;
  sound1.oscillator.frequency.value = frequency; // value in hertz
  sound1.oscillator.start();
  sound1.panner = this.audioCtx.createPanner();
  sound1.oscillator.connect(sound1.volume);
  sound1.volume.connect(sound1.panner);
  sound1.panner.connect(this.mainVolume)
  var x = Math.sin(deg*Math.PI*2)*frequency;
  var y = Math.cos(deg*Math.PI*2)*frequency;
  var now = {x:x,y:0,z:y};
  //console.log('xy',x,y)
  sound1.panner.setPosition(now.x,now.y,now.z);
  var mesh1 = new THREE.Mesh(soundGeo,_this.standardMaterial);
  mesh1.position.set(now.x,now.y,now.z);

  var sound2 = {
    oscillator:this.audioCtx.createOscillator(),
    volume: this.audioCtx.createGain(),
  };
  sound2.oscillator.type = this.waveType;
  sound2.oscillator.frequency.value = frequency+diff; // value in hertz
  sound2.oscillator.start();
  sound2.panner = this.audioCtx.createPanner();
  sound2.oscillator.connect(sound2.volume);
  sound2.volume.connect(sound2.panner);
  sound2.panner.connect(this.mainVolume)
  var x = Math.sin((1-deg)*2*Math.PI)*frequency;
  var y = Math.cos((1-deg)*2*Math.PI)*frequency;
  var now2 = {x:x,y:0,z:y};
  sound2.panner.setPosition(now.x,now.y,now.z)
  var mesh2 = new THREE.Mesh(soundGeo,_this.standardMaterial);
  mesh2.position.set(now2.x,now2.y,now2.z);
  var rad = frequency*0.11;
  var geo = new THREE.Geometry();
  var geo2 = new THREE.Geometry();
  var obj1 = new THREE.Object3D();
  obj1.position.set(now.x,now.y,now.z);
  var obj2 = new THREE.Object3D();
  obj2.position.set(now2.x,now2.y,now2.z);
  for(var ii=0;ii<1;ii+=1/360){
    var x = Math.sin(ii*Math.PI*2)*rad;
    var y = Math.cos(ii*Math.PI*2)*rad;
    var x2 = Math.sin(-ii*Math.PI*2)*rad;
    var y2 = Math.cos(-ii*Math.PI*2)*rad;
    var v = new THREE.Vector3(x,0,y);
    var v2 = new THREE.Vector3(x2,0,y2);

    geo.vertices.push(v);
    geo2.vertices.push(v2);
  }

  var lineMat = new THREE.LineBasicMaterial({color:0x4466cc,opacity:0.5,transparent:true})
  var lineMat2 = new THREE.LineBasicMaterial({color:0x4466cc,opacity:0.5,transparent:true})
  var line = new THREE.Line(geo,lineMat);
  obj1.add(line)

  var line2 = new THREE.Line(geo2,lineMat2);
  obj2.add(line2)
  _this.A_Waves.add(obj1);
  _this.B_Waves.add(obj2);
  _this.scene.add(mesh1,mesh2);
  
}
Sounds.prototype.render = function(){
  var _this = this;
  if(typeof this.inc == "undefined"){
    this.inc = 0.01;
    this.dir = 1;
    this.rippleScale = 1;
    this.cameraDir = -1;
  }
  this.rippleScale += (_this.inc*_this.dir);
  if(this.rippleScale > 26){
    this.dir = -1;
  }
  if(this.rippleScale <=1){
    this.rippleScale = 1;
    this.dir = 1;
  }



  var scaleAdd = 0.01;
  var pY = _this.camera.position.y;
  if(pY > 1000){
    this.cameraDir = -1;
  }
  if(pY < 100){
    this.cameraDir = 1;
  }
  this.camera.rotation.x += this.inc
  pY += (pY*0.002) * this.cameraDir;
  _this.camera.position.setY(pY);
  if(typeof _this.A_Waves != "undefined"){
    _this.A_Waves.children.forEach(function(lineObj,i){
      lineObj.children.forEach(function(mesh,ii){
        var sV = _this.rippleScale;
        mesh.scale.set(sV,sV,sV);
      })
      
    });
  }
  if(typeof _this.B_Waves != "undefined"){
    _this.B_Waves.children.forEach(function(lineObj,i){
      lineObj.children.forEach(function(mesh,ii){
        var sV = _this.rippleScale;
        mesh.scale.set(sV,sV,sV);
      })
      
    });
  }
  _this.renderer.toneMappingExposure = Math.pow( params.exposure , 4.0 );
  _this.composer.render();
  _this.controls.update();
  _this.spotLight.position.set(_this.camera.position.x,_this.camera.position.y,_this.camera.position.z)
  _this.spotLight.lookAt(_this.controls.target)
  if ( _this.roughnessMap !== undefined ) {
    _this.textureUpdateTargets.forEach(function(x,i){
      x.material.roughness = params.roughness;
      x.material.bumpScale = params.bumpScale;
      var newEnvMap = x.envMap;
      newEnvMap = _this.hdrCubeRenderTarget ? _this.hdrCubeRenderTarget.texture : null;

      if( newEnvMap !== x.envMap ) {

        x.envMap = newEnvMap;
        x.needsUpdate = true;

      }
    })
    if ( _this.standardMaterial !== undefined ) {

      _this.standardMaterial.roughness = 1.0;
      _this.standardMaterial.bumpScale = - 0.05;

      var newEnvMap = _this.standardMaterial.envMap;
      newEnvMap = _this.hdrCubeRenderTarget ? _this.hdrCubeRenderTarget.texture : null;

      if( newEnvMap !== _this.standardMaterial.envMap ) {

        _this.standardMaterial.envMap = newEnvMap;
        _this.standardMaterial.needsUpdate = true;

      }

    }

    _this.renderer.toneMappingExposure = Math.pow( params.exposure, 4.0 );
    
  }
  this._animationFrame = window.requestAnimationFrame(function(){
    _this.controls.update();
    _this.render();
    TWEEN.update();
  })
}
