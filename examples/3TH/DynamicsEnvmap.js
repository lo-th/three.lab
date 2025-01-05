/*import { HDRLab } from './HDRLab.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { HDRJPGLoader } from './HDRJPGLoader.js';*/
import {
	EventDispatcher, Scene, CubeCamera, WebGLCubeRenderTarget, Color, Fog, FogExp2, DoubleSide, MeshStandardMaterial, PointLight,
    LinearFilter, HalfFloatType, RGBAFormat, LinearSRGBColorSpace, NoToneMapping,SRGBColorSpace,
    TorusGeometry, SphereGeometry, BoxGeometry, PlaneGeometry, MeshBasicMaterial, BackSide, Mesh, Group,
    TextureLoader, AdditiveBlending,HemisphereLight,AmbientLight
} from 'three';

export class DynamicsEnvmap {

	constructor( renderer, scene, o = {} ) {

		this.renderer = renderer;
		this.mainScene = scene;

		this.useBackground = false;

		this.initCubeEnv(o);

		this.list = []
		this.ball = []
		this.garbage = [];

		//this.mainScene.backgroundBlurriness = 0.15

		/*this.envName = o.envName;

		this.env = phy.addEnvmap({...o, cube:true})//, url:'./textures/photo.hdr'

		

		*/

		this.init();

	}

	clamp ( v, min = 0, max = 1 ) {
        v = v < min ? min : v;
        v = v > max ? max : v;
        return v;
    }

    rand ( low = 0, high = 1 ) { 
    	return low + Math.random() * ( high - low ) 
    }

	initCubeEnv( o = {} ) {

		this.isCubeEnv = true;
		this._quality = o.quality || 2;

		this.scene = new Scene();
		if(o.color) this.scene.background = new Color(o.color) 
		this.target = new WebGLCubeRenderTarget( 256*this._quality, {
			//magFilter: LinearFilter,
            //minFilter: LinearFilter,
            type: HalfFloatType,
            colorSpace: SRGBColorSpace, 
            //anisotropy:1,
        });

        this.camera = new CubeCamera( o.near || 0.1, o.far || 100, this.target );
		this.mainScene.environment = this.target.texture;
		if( this.useBackground ) this.mainScene.background = this.target.texture;

	}

	render() {

		const renderer = this.renderer;
        const lastToneMapping = renderer.toneMapping;
        //const lastToneExposure = renderer.toneMappingExposure;
        renderer.toneMapping = NoToneMapping;
        //renderer.toneMappingExposure = 1.0;

		this.camera.update( renderer, this.scene );
        renderer.toneMapping = lastToneMapping;
        //renderer.toneMappingExposure = lastToneExposure;

	}

	init(){



		const scene = this.scene;

		//this.envLight = new HemisphereLight( 0xffffff,  0xffffff, 30 )
		//const envLight = new AmbientLight(  0xffffff, 100 )
		//scene.add( this.envLight )
		

		//this.env.useBackground = false
		//this.addEnvmap(this.envName);
		//scene.background = null
		//scene.environmentIntensity = 0.0;
		//scene.bgIntensity = 10;
		//this.env.mainScene.background = this.env.target.texture;

		//this.env.background = false
		//this.env.load('./textures/cinema_lobby_1k.hdr')
		/*this.env.load('./textures/'+this.envName+'.jpg' )*/
		//scene.background = new Color(0x232e42);
		
		//this.env.blur = 0.5
		//this.env.bgIntensity = 1.0//0.25

		

		this.addBall()

		
		//return
		//this.env.render()

		let mat = new MeshBasicMaterial( { color:new Color(10,10,10), transparent:true } )
		let p = new TorusGeometry(10, 0.05)
		p.rotateX(Math.PI*0.5)
		let m = new Mesh(p, mat);
		m.position.y = -10
		scene.add( m );

		this.list.push(m)

		/*mat = new MeshBasicMaterial( { color:new Color(20,20,20), transparent:true } )
		p = new PlaneGeometry(5,5)
		p.rotateX(Math.PI*0.5)
		m = new Mesh(p, mat);
		m.position.y = 10
		scene.add( m );

		this.list.push(m)*/

		

	}

	addBall(){

		const scene = this.scene;

		let mat = new MeshBasicMaterial( { 
			//blending:AdditiveBlending, 
			color:new Color(0,0,0), transparent:true, opacity:0 } )
		let p = new SphereGeometry(1)

		let i = 30, m, s, r, d;
		while(i--){
			r = this.rand(-Math.PI, Math.PI);
			d = this.rand(5, 10);
			s = this.rand(0.02,1)
			m = new Mesh(p, mat.clone() );
			m.material.color.set(this.rand(), this.rand(), this.rand()).multiplyScalar(this.rand(1, 100))
			m.position.set(Math.sin(r)*d, this.rand(-20,-10), Math.cos(r)*d)
			m.scale.set(s,s,s)
			scene.add( m );
			this.ball.push(m)

		}

	}

	add( b, inTmp ){

		//b.material = new MeshStandardMaterial({ color:new Color(0.3,0.3,0.3), roughness:0.8}) //.envmap = this.env.scene.environment
		b.frustumCulled = false
		//if(b.children) b.children[0].material = b.material
		this.env.scene.add(b);
		if(inTmp) this.garbage.push(b);

	}

    clearGarbage(){

    	let i = this.garbage.length
    	while(i--){
    		this.scene.remove(this.garbage[i]);
    	}
    	this.garbage = []
    }

	addEnvmap(name){

		//this.env.load('./textures/'+name+'.hdr')
		//this.env.scene.backgroundIntensity = 1;

	}

	getClone(){
		this.render()
		return this.target.texture.clone()
	}

	update(){
		
		
		//this.layer.latitude+=0.1
		//if(this.hdr.needsRender) this.hdr.render();

		let i = this.ball.length, p=0, a = 0
		while(i--){
			this.ball[i].position.y += 0.02
			p = this.ball[i].position.y
			a = 1 - Math.abs(p*0.1);
			a = this.clamp(a,0,1)
			this.ball[i].material.opacity = a
			if(p > 10){ 
				this.ball[i].position.y = -10
				this.ball[i].material.color.set(this.rand(), this.rand(), this.rand()).multiplyScalar(this.rand(1, 100))
			}
		

		}

		if(this.list.length){
			//this.list[0].position.y += 0.02
		    a = 1 - Math.abs(this.list[0].position.y*0.1);
		    a = this.clamp(a, 0,1)
		   // if(this.list[0].position.y<-10) this.list[0].visible = false
		   // else this.list[0].visible = true
		    this.list[0].material.opacity = a
		    if(this.list[0].position.y>10) this.list[0].position.y = -10
		}

		//const lastToneExposure = window.renderer.toneMappingExposure;
        //window.renderer.toneMappingExposure = 2.0
		this.render()
		//window.renderer.toneMappingExposure = lastToneExposure
	}


	get intensity() {
        return this.mainScene.environmentIntensity;
    }
    set intensity(value) {
        this.mainScene.environmentIntensity = value;
    }


    get bgIntensity() {
        return this.env.bgIntensity;
    }
    set bgIntensity(value) {
        this.env.bgIntensity = value;
    }

    get blur() {
        return this.env.blur;
    }
    set blur(value) {
        this.env.blur = value;
    }
}