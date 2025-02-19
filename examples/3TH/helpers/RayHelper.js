import { Vector3, Object3D, Line, LineSegments, LineBasicMaterial, Float32BufferAttribute, BufferGeometry, MathUtils } from 'three';



const _vector = /*@__PURE__*/ new Vector3();

export class RayHelper extends Line {

	

	constructor( Raycaster ) {

		const positions = [0,0,0, 0,-1,0, 0,-1,0];
	    const colors = [0,0,0, 0,0,0, 0,0,0];

	    let geometry = new BufferGeometry();
	    geometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
	    geometry.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );

		let material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });

		super( geometry, material );

		this.ray = Raycaster.ray;

	    this.vertices = this.geometry.attributes.position;
	    this.colors = this.geometry.attributes.color;
	    this.normal = new Vector3();
	    this.local = new Vector3();
	    this.tmp = new Vector3();

	    
	    //this.frustumCulled = false;

	}


	dispose() {

		this.geometry.dispose();
		this.material.dispose();

	}

	updateMatrixWorld( force ){

		this.position.copy( this.ray.origin )

		let p = this.vertices.array;
		let c = this.colors.array;
		let d

		if(this.ray.hit){

			d = this.ray.max - this.ray.hit.distance;

		    //c[ 0 ] = 1;
		    c[ 3 ] = 1;
			c[ 6 ] = 1;
			c[ 7 ] = 0;

			this.local.copy(this.ray.hit.point).sub( this.position );
			this.local.toArray( p, 3 );
			this.tmp.copy(this.local).normalize(); 
			this.normal.copy(this.ray.hit.face.normal );
			this.local.addScaledVector( this.normal, d );
			this.local.toArray( p, 6 );

			let angle = 180 - Math.floor( this.tmp.angleTo( this.normal ) * MathUtils.RAD2DEG );

		} else {

			c[ 0 ] = 0;
		    c[ 3 ] = 0;
			c[ 6 ] = 0;
			c[ 7 ] = 0;

			p[3] = 0
			p[4] = -this.ray.max
			p[5] = 0

			p[6] = 0
			p[7] = -this.ray.max
			p[8] = 0	 
		}

		this.vertices.needsUpdate = true;
	    this.colors.needsUpdate = true;

    	super.updateMatrixWorld(force);

    	
    	

    }

	raycast(){
		return false
	}

}
