import { Vector3, Object3D, LineSegments, LineBasicMaterial, Float32BufferAttribute, BufferGeometry } from 'three';



const _vector = /*@__PURE__*/ new Vector3();

class CapsuleHelper extends Object3D {

	

	constructor( r, h, c1 = [0,1,0], c2 = [0,0.5,0], useDir=false, full = false ) {

		super();

		if(!r) return
		if(!h) return

		const geometry = new BufferGeometry();
	    const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });

		let py = (h-r)*0.5
		let side = 12;
		let dir = r*0.2

		let colors = [];

		const positions = [
		    r, py, 0 ,   r, -py, 0,
		    -r, py, 0 ,   -r, -py, 0,
		    0, py, r-dir ,   0, py, r+dir,
		];


		colors.push(
			...c1,...c2,
			...c1,...c2,
			...c2,...c2
		)

		if(full){ 
			positions.push(
				0, py, r, 0, -py, r,
				0, py, -r, 0, -py, -r 
			);
			colors.push(
				...c1,...c2,
				...c1,...c2,
			)
		}

		// circle top / bottom

		for ( let i = 0, j = 1; i < side; i ++, j ++ ) {

			const p1 = ( i / side ) * Math.PI * 2;
			const p2 = ( j / side ) * Math.PI * 2;

			positions.push(
				r*Math.cos( p1 ), py, r*Math.sin( p1 ),
				r*Math.cos( p2 ), py, r*Math.sin( p2 ),

				r*Math.cos( p1 ), -py, r*Math.sin( p1 ),
				r*Math.cos( p2 ), -py, r*Math.sin( p2 ),
			);

			colors.push(
				...c1,...c1,
				...c2,...c2,
			)

		}

		// circle start / end

		for ( let i = 0, j = 1; i < side; i ++, j ++ ) {

			const p1 = ( i / side ) * Math.PI * 2;
			const p2 = ( j / side ) * Math.PI * 2;

			let s = j <= side*0.5 ? 1 : -1 

			positions.push(
				r*Math.cos( p1 ), py*s + r*Math.sin( p1 ),0,
				r*Math.cos( p2 ), py*s + r*Math.sin( p2 ),0,
			);

			if(s===1) colors.push( ...c1,...c1 )
			else colors.push( ...c2,...c2 )

			if(full){
				positions.push(
					0, py*s + r*Math.sin( p1 ),r*Math.cos( p1 ),
					0, py*s + r*Math.sin( p2 ),r*Math.cos( p2 ),
				);
				if(s===1) colors.push( ...c1,...c1 )
			    else colors.push( ...c2,...c2 )
			}

		}

		geometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		geometry.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );

		geometry.computeBoundingSphere()

		this.colors = geometry.attributes.color.array;
		this.colorsbase = [...this.colors]
		this.geometry = geometry;

		this.cone = new LineSegments( geometry, material );
		this.cone.raycast = function(){return false }
		this.cone.updateMorphTargets = ()=>{}
		this.cone.name = 'cone'
		this.add( this.cone );

		this.isOver = false;
		//this.matrixAutoUpdate = false;
		this.type = 'CapsuleHelper';

		this.material = material;
		


		if(!useDir) return

		const geometry2 = new BufferGeometry();

		const positions2 = [
		    dir*0.5, -py, r-dir ,   dir*0.5, -py, r+dir,
		    -dir*0.5, -py, r-dir ,   -dir*0.5, -py, r+dir,
		    dir*0.5, -py, r-dir,  -dir*0.5, -py, r-dir,

		    -dir*0.5, -py, r+dir , -dir, -py, r+dir ,
		    dir*0.5, -py, r+dir , dir, -py, r+dir ,

		    -dir, -py, r+dir , 0, -py, r+dir*2 ,
		    dir, -py, r+dir , 0, -py, r+dir*2 ,
		];

		colors = []
		let cc = positions2.length/3
		while(cc--){
			colors.push(1,0,0)
		}

		geometry2.setAttribute( 'position', new Float32BufferAttribute( positions2, 3 ) );
		geometry2.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );



		//const material2 = new LineBasicMaterial( { color:0xFF0000, fog: false, toneMapped: false } );

		this.direction = new LineSegments( geometry2, material );
		this.direction.raycast = function(){ return false }
		this.direction.rotation.y = Math.PI
		this.add( this.direction );

	}


	dispose() {

		this.geometry.dispose();
		this.cone.geometry.dispose();

		if(this.direction){
			this.direction.geometry.dispose();
		}

		this.material.dispose();

	}

	raycast(){
		return false
	}

}


export { CapsuleHelper };
