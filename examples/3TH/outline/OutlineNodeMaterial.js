import { Color, NodeMaterial } from "three"
import { attribute, uniform, color, varying, int, vec4, vec3, cameraProjectionMatrix, modelViewMatrix, normalize, length, If, dot, acos, property, cameraPosition, sign, Fn } from 'three/tsl';

const PI_INV = 1 / Math.PI
const torad = Math.PI / 180;

export class OutlineNodeMaterial extends NodeMaterial {

    constructor(_angleThreshold = 0, outline = 0, Color = "#ffffff") {

    	super()

    	this.uAngleThresh = uniform( _angleThreshold*torad );
		this.uOutline = uniform( outline, 'int' );

		//this.uAngleThresh = uniform( 0 );
		//this.uOutline = uniform(1);
		//const uColor = uniform( 'vec3' );
		const vDebug = varying( vec4(), 'vDebug' );

		this.uColor = uniform( color( Color ) );

    	this.vertexNode =  /*@__PURE__*/ Fn( () => {

    		const valide = int( 0 );

    		const position = attribute("position")
    		const aN0 = attribute("aN0");
    		const aN1 = attribute("aN1");
    		const aOtherVert = attribute("aOtherVert");

			const mv = modelViewMatrix.mul( vec4( position, 1. ) );
			const pos = vec4( cameraProjectionMatrix.mul( mv ) );

			
			const viewDir = normalize( mv.xyz.negate() );

			//check for null normals

			const l0 = length( aN0 ).toVar();
			const l1 = length( aN1 ).toVar();

			If( l0.mul( l1 ).lessThan( 0.0001 ), () => {

				valide.assign( 1 );

			} );

			//end of mesh

			const dd = dot( normalize( aN0 ), normalize( aN1 ) );

			If( acos( dd ).greaterThan( this.uAngleThresh ), () => {

				valide.assign( 1 );

			} );

			//find point

			const isOther = aOtherVert.w.greaterThan( 0.5 );
			const a = vec3( 0.0 )//.toVar();//property( 'vec3' );
			const b = vec3( 0.0 )//.toVar();//property( 'vec3' );

			If( isOther, () => {

				a.assign( aOtherVert.xyz );
				b.assign( position );

			} ).Else( () => {

				a.assign( position );
				b.assign( aOtherVert.xyz );

			} );

			const ld = normalize( b.sub( a ) );
			const camToEdge = cameraPosition.sub( a );
			const f = dot( camToEdge, ld ).toVar();
			const p = a.add( ld.mul( f ) ).toVar();
			p.assign( normalize( p.sub( cameraPosition ) ) );
			const vp = modelViewMatrix.mul( vec4( p, 0. ) ).xyz;
			const vN0 = modelViewMatrix.mul( vec4( aN0, 0. ) ).xyz;
			const vN1 = modelViewMatrix.mul( vec4( aN1, 0. ) ).xyz;
			vDebug.x.assign( sign( dot( vN0, viewDir ) ) );
			vDebug.y.assign( sign( dot( vN1, viewDir ) ) );
			const outline = sign( dot( vN0, viewDir ) ).mul( sign( dot( vN1, viewDir ) ) ).lessThan( 0. );

			If( this.uOutline.equal( 1 ).and( outline ), () => {

				valide.assign( 1 );

			} );

			//pos.x.assign(vDebug.x);

			If( valide.equal( 0 ), () => {

				pos.z.assign( -2000. );

			});

			return pos

		} )();


		this.colorNode = Fn( () => {

			const ret = vec4(this.uColor, 1.0);
			return ret;

        } )();
        
    }
    set angleThreshold(degrees) {
        this._angleThreshold = degrees
        this.uAngleThresh.value = (degrees * torad ) % Math.PI
    }
    get angleThreshold() {
        return this._angleThreshold
    }
    set outline(outline) {
        this.uOutline.value = Number(outline)
    }
    get outline() {
        return Boolean(this.uOutline.value)
    }
    set color(v) {
        this.uColor.value.setHex( v )
    }
    get color() {
        return this.uColor.value
    }
}





