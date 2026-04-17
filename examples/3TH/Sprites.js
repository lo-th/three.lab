import * as THREE from 'three/webgpu'
import { float, If, Fn, uniform, deltaTime, time, vertexIndex, instanceIndex, instancedBufferAttribute, vec2, vec3, vec4, uv, sin, oscSine, texture, pointUV, mod, floor } from 'three/tsl';

const range = 5
const double = range*2
const size = 0.06
export class Sprites extends THREE.Sprite {

	constructor (name, texturemap, max = 1000000) {

		super()

		this.name = name

		this.map = new Map();

		this.idp = [];

		this.pp = []
		let i = max
		while(i--) this.pp.push(0,0,0)

		this.pos = new THREE.InstancedBufferAttribute( new Float32Array( max*3 ), 3 );
		this.pos.usage = THREE.DynamicDrawUsage

		//const textureLoader = new THREE.TextureLoader();
		//const map = map//textureLoader.load( './textures/run.png' );
		//map.colorSpace = THREE.SRGBColorSpace;



		this.material = new THREE.SpriteNodeMaterial( { sizeAttenuation: true, alphaTest: 0.1 } );


		const self = this





		const posSheet = Fn(()=>{

			const speed = time.mul(0.2)
			const freq = floor(speed.div(double)).mul(double)
			const position = instancedBufferAttribute( this.pos ).add(vec3(speed.sub(freq),0,0));

			If( position.x.greaterThan( range ), () => {
				//position.x = -4.5
				//self.pos.setX( instanceIndex, -4.5 ) 
				position.x.addAssign( float(-double))//.add( floor(time.div(9)) ) );
				//position.x.assign( -4.5 );
			})
			
			return position
		})
		//this.material.color.setHSL( 1.0, 0.3, 0.7, THREE.SRGBColorSpace );
		this.material.positionNode = posSheet()
		//this.material.rotationNode = Math.PI 
		//this.material.rotationNode = time.add( instanceIndex ).sin();
		this.material.scaleNode = uniform( size );

		this.uv = new THREE.InstancedBufferAttribute( new Float32Array( max*2 ), 2 );
		const selfUV = instancedBufferAttribute( this.uv )

		const animCycle = 1/20

		const spriteSheet = Fn(()=>{

			const fTime = floor(time.div( animCycle )).mod(8);
			const uv0 = uv().mul( vec2(0.125, 0.5) ).add(selfUV);
			const animateUv = vec2( uv0.x.add( ( fTime ).mul(0.125) ), uv0.y )
			const myMap = texture( texturemap, animateUv )
			return myMap

		})

		this.material.colorNode = spriteSheet()

		

		this.count = 0;
		this.frustumCulled = false;

	}

	hasItem(i){
		
		return this.map.has(i)

	}

	updateRange(){
		//this.pos = new THREE.InstancedBufferAttribute( new Float32Array( max*3 ), 3 );
	}

	rand( low = 0, high = 1 ){ return low + Math.random() * ( high - low ) }
	randInt( low = 0, high = 1 ){ return low + Math.floor( Math.random() * ( high - low + 1 ) ) }

	addItem( i, x, y, z){

		if(i===undefined) i = this.count
		if(x===undefined) x = this.rand(-range, range)
		if(y===undefined) y = size*0.5
		if(z===undefined) z = this.rand(-range, range)

		this.pos.setXYZ( this.count, x, y, z ) 
		this.map.set( i, this.count )

		this.uv.setXY( this.count, 0.125 * this.randInt(0,7), 0.5 * this.randInt(0,1) );
		this.uv.needsUpdate = true
		
		this.count++
		//if(this.count > max) this.pos.addUpdateRange( max, 3 )
		this.pos.needsUpdate = true

	}

	removeItem( i ){

		if(!this.map.has(i)) return

		let j = this.map.get(i);

	    let isFire = this.name === 'fire'

	    // switch current with last
	    let last = this.count-1
	    if( j < last ){ 
	    	this.pos.setXYZ( j, this.pos.getX(last), this.pos.getY(last), this.pos.getZ(last) ) 
	    	this.uv.setXY( j, this.uv.getX(last), this.uv.getY(last) )
	    }
	    
		this.count--
	    this.map.delete( i )
		this.pos.needsUpdate = true


	}


}