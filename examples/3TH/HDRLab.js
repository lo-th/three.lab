
import {
    EventDispatcher, Vector2, Vector4,
    NoBlending, NormalBlending , AdditiveBlending, MultiplyBlending,
    UniformsUtils, 
    Color, HalfFloatType,
    ShaderMaterial, OrthographicCamera, Scene, PlaneGeometry, Mesh,WebGLRenderTarget, ACESFilmicToneMapping,
    DataTexture, RGBAFormat, UnsignedByteType, LinearFilter, EquirectangularReflectionMapping,
    //LinearEncoding, sRGBEncoding,
    TextureLoader,
    LinearSRGBColorSpace, SRGBColorSpace, NoColorSpace,
    
} from 'three';

let _jpgHdrTextureLoader = null;
let _rgbeTextureLoader = null;
let _exrTextureLoader = null;
let _envTextureLoader = null;
let _textureLoader = new TextureLoader();
_textureLoader.setCrossOrigin("");

const ThreeD = 0;
const Planer = 1;
const torad = Math.PI / 180;

export class HDRLab extends EventDispatcher {

    get quality() {
        return this._quality;
    }
    set quality(value) {
        this._quality = value;
        this.setSize(1024*this._quality, 512*this._quality);
    }

    get brightness() {
        return this._copyMaterial.uniforms.brightness.value;
    }
    set brightness(value) {
        this._dirty = true;
        this._copyMaterial.uniforms.brightness.value = value;
        this._copyMaterial.uniformsNeedUpdate = true;
    }
    get contrast() {
        return this._copyMaterial.uniforms.contrast.value;
    }
    set contrast(value) {
        this._dirty = true;
        this._copyMaterial.uniforms.contrast.value = value;
        this._copyMaterial.uniformsNeedUpdate = true;
    }
    get exposure() {
        return this._copyMaterial.uniforms.exposure.value;
    }
    set exposure(value) {
        this._dirty = true;
        this._copyMaterial.uniforms.exposure.value = value;
        this._copyMaterial.uniformsNeedUpdate = true;
    }

    // for envmap

    get intensity() {
        if(this.mainScene) return this.mainScene.environmentIntensity;
    }
    set intensity(value) {
        if(this.mainScene) this.mainScene.environmentIntensity = value;
    }

    get bgIntensity() {
        if(this.mainScene) return this.mainScene.backgroundIntensity;
    }
    set bgIntensity(value) {
        if(this.mainScene) this.mainScene.backgroundIntensity = value;
    }

    get blur() {
        if(this.mainScene) return this.mainScene.backgroundBlurriness;
    }
    set blur(value) {
        if(this.mainScene) this.mainScene.backgroundBlurriness = value;
    }

    //

    set rgbeTextureLoader(value) {
        _rgbeTextureLoader = value
    }

    set exrTextureLoader(value) {
        _exrTextureLoader = value
    }

    set jpgHdrTextureLoader(value) {
        _jpgHdrTextureLoader = value
    }

    constructor( renderer, scene = null, background = false, keepbg = false ) {

        //console.log(LinearEncoding, LinearSRGBColorSpace)

        super();

        this.renderer = renderer;
        this.mainScene = scene;
        this.background = background;
        this._quality = 1;

        this.keepbg = keepbg;

        
        //this.blur = 0;
        //this.intensity = 1;
        //this.bgIntensity = 1;

        this.size = new Vector2(1024, 512);
        // protected textureCollection: Texture[];
        this._dirty = true;
        this.target = null;
        this._dataUrl = "";
        // protected _layerAddedCallbacks: LayerCallback[] = [];
        // protected _layerRemovingCallbacks: LayerCallback[] = [];
        this.defaultLayerUniform = {
            blendMode: AdditiveBlending,
            brightness: 1.0,
            exposure: 1.0,
            clipUv: new Vector2(0, 0),
            color: new Vector4(0, 0, 0, 0),
            contrast: 1.0,
            isHidden: true,
            mapping: ThreeD,
            mirrorX: false,
            mirrorY: false,
            position: new Vector2(0, 0),
            rotation: 0,
            size: new Vector2(0, 0),
            textureEncoding: 0,//LinearEncoding,
            name: "",
            textureIsCube: 0
        };
        this._uniforms = UniformsUtils.clone(this.defaultLayerUniform);
        this._lastTarget = null;
        HDRLab.dummyTexture.needsUpdate = true;
        HDRLab.blackTexture.needsUpdate = true;
        this.baseShaderUniforms = UniformsUtils.clone(equiMapShader.uniforms);
        this.layers = [];
        // this.textureCollection = [];
        this.layerCollection = [];
        // for(let i =0 ; i < equiMapShader.defines.MAX_LAYERS; i++){
        //     this.layerCollection.push(this.defaultLayerUniform);
        //     this.textureCollection.push(HDRLab.dummyTexture);
        // }
        // this.baseShaderUniforms.layers.value = this.layerCollection;
        // this.baseShaderUniforms.textures.value = this.textureCollection;
        // this.baseShaderUniforms.numLayers.value = 0;
        const shaderParams = {
            uniforms: this.baseShaderUniforms,
            defines: equiMapShader.defines,
            vertexShader: equiMapShader.vertexShader,
            fragmentShader: equiMapShader.fragmentShader,
        };


        shaderParams.defines.baseTextureEncoding = 0//LinearEncoding; // is this outputColorSpace?
        this.shaderMaterial = new ShaderMaterial(shaderParams);
        this.shaderMaterial.extensions.shaderTextureLOD = true;
        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.scene = new Scene();
        const geometry = new PlaneGeometry(2, 2);
        this.mesh = new Mesh(geometry, this.shaderMaterial);
        this.scene.add(this.mesh);
        // this._canvas = document.createElement( 'canvas' );
        // this._canvas.width = this.size.x;
        // this._canvas.height = this.size.y;
        // this._context = this._canvas.getContext( '2d' );
        this._targets = [
            new WebGLRenderTarget(this.size.x, this.size.y, { type: HalfFloatType, depthBuffer: false, generateMipmaps: false }),
            new WebGLRenderTarget(this.size.x, this.size.y, { type: HalfFloatType, depthBuffer: false, generateMipmaps: false }),
            new WebGLRenderTarget(this.size.x, this.size.y, { type: HalfFloatType, depthBuffer: false, generateMipmaps: false }),
        ];
        this._copyMaterial = new ShaderMaterial(CopyShader);
        this._copyMaterial.toneMapped = true;
        this._copyMaterial.uniforms.opacity.value = 1;
        
    }

    // for envmap

    rotate( x=0,y=0,z=0 ) {
        if( !this.mainScene ) return
        if(x!==0) x *= torad;
        if(y!==0) y *= torad;
        if(z!==0) z *= torad;

        this.mainScene.environmentRotation.set(x,y,z)
        if( this.background ) this.mainScene.backgroundRotation.set(x,y,z)
    }


    /*getTarget() {
        return this.target.texture
    }*/

    setTarget() {

        if( this.target ){ 
            this.target.texture.needsPMREMUpdate = true;
            if( this.mainScene && !this.keepbg) {
                if(this.mainScene.background) this.mainScene.background.dispose()
                this.mainScene.background = this.background ? this.target.texture : null;
            }
            return this.target;
        }

        this.target = new WebGLRenderTarget( this.size.x, this.size.y, {
            magFilter: LinearFilter,
            minFilter: LinearFilter,
            type: HalfFloatType,
            format: RGBAFormat,
            colorSpace: LinearSRGBColorSpace,
            generateMipmaps: false,
            depthBuffer: false
        });

        this.target.texture.mapping = EquirectangularReflectionMapping;

        if( this.mainScene ){
            this.mainScene.environment = this.target.texture;
            if( this.background ) this.mainScene.background = this.target.texture;
        }
        return this.target;

    }
    // getDataUrl(renderer: WebGLRenderer, size?: { x: number, y: number }){
    //     // let canvas_ = document.createElement( 'canvas' );
    //     // canvas_.width = 1024;
    //     // canvas_.height = 512;
    //     // let context_ = canvas_.getContext( '2d' );
    //
    //     this._dirty = true;
    //     let old_size = new Vector2();
    //     let old_size_2 = this.getSize();
    //     renderer.getDrawingBufferSize(old_size);
    //     if (size) this.setSize(size.x, size.y)
    //     renderer.setSize(this.size.x, this.size.y);
    //     renderer.setViewport(0,0,this.size.x,this.size.y);
    //     renderer.setScissor(0,0,this.size.x,this.size.y);
    //     this.render(renderer);
    //
    //     this._context && this._context.drawImage( renderer.domElement, 0, 0 );
    //     this._dataUrl = this._canvas.toDataURL("image/png", 100);
    //     renderer.setSize(old_size.x, old_size.y);
    //     if (size) this.setSize(old_size_2.x, old_size_2.y);
    //     return this._dataUrl;
    // }
    get needsRender() {
        return this._dirty;
    }

    render( encoding = 'linear' ) {

        const renderTarget = this.setTarget();
        const renderer = this.renderer;

        const render = (target, mat) => {
            renderer.setRenderTarget(target ?? null);
            if (mat)
                [mat, this.mesh.material] = [this.mesh.material, mat];
            renderer.render(this.mesh, this.camera);
            this.mesh.material = mat ?? this.shaderMaterial;

        };
        //this.stats && this.stats.begin();
        const lastAutoClear = renderer.autoClear;
        const lastToneMapping = renderer.toneMapping;
        //const lastOutputColorSpace = renderer.outputColorSpace;

        const oldTarget = renderer.getRenderTarget();
        const oldActiveCubeFace = renderer.getActiveCubeFace();
        const oldActiveMipmapLevel = renderer.getActiveMipmapLevel();
        const oldXrEnabled = renderer.xr.enabled;

        renderer.autoClear = false;
        renderer.xr.enabled = false;
        
        if (this._dirty) {
            this.baseShaderUniforms.baseTexture.value = HDRLab.blackTexture;
            this._targets.forEach(value => {
                renderer.setRenderTarget(value);
                renderer.clear();
            });
            let target = this._targets[0];
            for (let i = 0; i < this.layerCollection.length; i++) {
                if (this.layers[i].hidden) {
                    [this._targets[0], this._targets[1]] = [this._targets[1], this._targets[0]];
                    continue;
                }
                target = this._targets[i % 2];
                this.baseShaderUniforms.layerIndex.value = i;
                this.baseShaderUniforms.layer.value = this.layerCollection[i];
                this.shaderMaterial.defines.CUBE_TEXTURE = this.layers[i].isCubeTexture ? 1 : 0;
                this.shaderMaterial.defines.BLEND = 1;
                this.baseShaderUniforms.layerTexture.value = this.layers[i].texture.value ?? HDRLab.dummyTexture;
                if (this.layers[i].alphaTexture.value) {
                    this.shaderMaterial.defines.ALPHA_TEXTURE = 1;
                    this.baseShaderUniforms.layerAlphaTexture.value = this.layers[i].alphaTexture.value;
                }
                let filters = this.layers[i].filters;
                if (filters.length > 0) this.shaderMaterial.defines.BLEND = 0;
                this.shaderMaterial.needsUpdate = true;
                // renderer.autoClear = true;
                render(target);
                // renderer.autoClear = false;
                this.shaderMaterial.defines.CUBE_TEXTURE = 0;
                this.shaderMaterial.defines.ALPHA_TEXTURE = 0;
                if (filters.length > 0) {
                    // renderer.setRenderTarget(null);
                    let j = 0;
                    let ts = [target, this._targets[2]];
                    let targetTex = target.texture;
                    for ( const filter of filters ) {
                        targetTex = filter.apply(render, ts[j % 2].texture, this.size, ts[(j + 1) % 2]);
                        j++;
                    }
                    if (targetTex === target.texture) {
                        target = this._targets[2];
                        this._targets[2] = this._targets[i % 2];
                        this._targets[i % 2] = target;
                    }
                    // assuming here targetTex !=  (target.texture)
                    this.shaderMaterial.defines.BLEND = 2;
                    this.baseShaderUniforms.layerTexture.value = targetTex;
                    this.shaderMaterial.needsUpdate = true;
                    // renderer.autoClear = true;
                    render(target);
                    // renderer.autoClear = false;
                }
                this.baseShaderUniforms.baseTexture.value = target.texture;
                // this.shaderMaterial.defines.BLEND = 0;
            }
            this._lastTarget = target;
        }
        
        if (this._lastTarget) {
            /*if (encoding !== 'linear') {
                this._copyMaterial.defines.OUTPUT_ENCODING = encoding === 'rgbm' ? 1 : encoding === 'rgbe' ? 2 : 0;
                //console.log(this._copyMaterial.defines.OUTPUT_ENCODING);
                this._copyMaterial.needsUpdate = true;
            }
            else {
                renderer.toneMapping = ACESFilmicToneMapping;
                renderer.outputColorSpace = SRGBColorSpace;
            }*/
            this._copyMaterial.uniforms.tDiffuse.value = this._lastTarget.texture;
            this._copyMaterial.uniformsNeedUpdate = true;
            // this.shaderMaterial.defines.BLEND = -1;
            // this.baseShaderUniforms.layerIndex.value = -1; // copy only
            // this.baseShaderUniforms.layerTexture.value = HDRLab.dummyTexture;
            // this.baseShaderUniforms.baseTexture.value = this._targets[0].texture;
            // renderer.setRenderTarget(renderTarget ?? null);
            // renderer.autoClear = true;
            render( renderTarget, this._copyMaterial );
            renderer.toneMapping = lastToneMapping;
            //renderer.outputColorSpace = lastOutputColorSpace;
            
            // renderer.autoClear = false;
            //if (encoding !== 'linear') {
            //    delete this._copyMaterial.defines.OUTPUT_ENCODING;
            //this._copyMaterial.needsUpdate = true;
            //}
        }
        //if (renderTarget) renderer.setRenderTarget(null);

        renderer.setRenderTarget( oldTarget, oldActiveCubeFace, oldActiveMipmapLevel );
        renderer.autoClear = lastAutoClear;
        renderer.xr.enabled = oldXrEnabled;

        //renderTarget.texture.needsPMREMUpdate = true
        this._dirty = false;
        //return this._lastTarget;
    }

    addFullScreenLayer(textureUrl = HDRLab.black1x1Texture, textureEncoding = 0/*LinearEncoding*/, textureType = "png") {
        return this.addLayer({
            name: "Background",
            longitude: 180,
            latitude: 0,
            width: 360.0 / equiMapShader.defines.PLANER_SIZE_MULTIPLIER,
            height: 180.0 / equiMapShader.defines.PLANER_SIZE_MULTIPLIER,
            color: "#ffffff",
            opacity: 1,
            projectionMapping: Planer,//0
            texture: { value: HDRLab.blackTexture, encoding: textureEncoding },
            // textureUrl: textureUrl,
            textureType: textureType
        });
    }

    addLayer( layer ) {
        // if(this.layers.length == equiMapShader.defines.MAX_LAYERS)
        //     return null;
        const layerThree = new LayerThree(layer);
        layerThree.name = layer.name ? layer.name : 'Layer' + this.layerCount;
        const uniforms = UniformsUtils.clone(this.defaultLayerUniform);
        uniforms.name = layerThree.name;
        this.layers.push(layerThree);
        this.layerCollection.push(uniforms);
        this._refreshUniforms(layerThree);
        layerThree.addPropertyChangedCallback(((layer1, property, value) => this.refreshLayer(layer1, property, value)));
        // this.textureCollection.push(HDRLab.dummyTexture);
        // this._refreshTextureForLayer(layerThree);
        // this.baseShaderUniforms.numLayers.value += 1;
        this._dirty = true;
        this.dispatchEvent({ type: 'addLayer', layer: layerThree });
        // this._layerAddedCallbacks.forEach(callback => callback(layerThree));
        return layerThree;
    }

    removeLayer(layer) {
        const index = this.layers.indexOf(layer);
        if (index < 0)
            return false;
        this.dispatchEvent({ type: 'removeLayer', layer });
        const layerThree = this.layers[index];
        layerThree.dispose();
        this.removeTexture(layer);
        // for(let i=index; i<this.layers.length-1; i++){
        //     this.layerCollection[i] = this.layerCollection[i+1];
        //     this.textureCollection[i] = this.textureCollection[i+1];
        // }
        // this.layerCollection[this.layers.length-1] = this.defaultLayerUniform;
        this.layers.splice(index, 1);
        this.layerCollection.splice(index, 1);
        this._dirty = true;
        return true;
    }

    getObjectForLayer(layer) {
        return layer.serialize();
    }

    saveScene() {
        let res = [];
        this.layers.forEach(layer => res.push(layer.serialize()));
        return res;
    }

    loadScene(jsonData, clearLayers = true) {
        if (clearLayers)
            this.removeAllLayers();
        let this_ = this;
        jsonData.forEach(value => {
            this_.addLayer(value);
        });
    }

    removeAllLayers() {
        while (this.layers.length > 0)
            this.removeLayer(this.layers[0]);
    }

    // public addLayerAddedListener(onLayerAdded: LayerCallback) {
    //     this._layerAddedCallbacks.push(onLayerAdded);
    // }
    //
    // public addLayerRemovingListener(onLayerRemoving: LayerCallback) { //before layer is removed
    //     this._layerRemovingCallbacks.push(onLayerRemoving);
    // }
    //
    // public removeLayerAddedListener(onLayerAdded: LayerCallback) {
    //     this._layerAddedCallbacks.filter(value => value != onLayerAdded);
    // }
    //
    // public removeLayerRemovingListener(onLayerRemoving: LayerCallback) { //before layer is removed
    //     this._layerRemovingCallbacks.filter(value => value != onLayerRemoving);
    // }

    getLayer(index) {
        return this.layers[index];
    }

    get layerCount() {
        return this.layers.length;
    }

    getLayerIndex(layer) {
        return this.layers.indexOf(layer);
    }

    setLayerIndex(layer, i) {
        let j = this.getLayerIndex(layer);
        if (i >= this.layers.length)
            i = this.layers.length - 1;
        if (i < 0)
            i = 0;
        if (i === j)
            return;
        this.layers.splice(i, 0, this.layers.splice(j, 1)[0]);
        this.layerCollection.splice(i, 0, this.layerCollection.splice(j, 1)[0]);
        this._dirty = true;
    }

    setSize( width, height ) {
        this.size.set( width, height );
        this._targets.forEach(value => value.setSize(width, height));
        this._dirty = true;
    }

    getSize() {
        return this.size;
    }

    _refreshUniforms(layer) {
        let layerIndex = this.getLayerIndex(layer);
        // for( let key in this.layerCollection) {
        //     const layerUniform: LightLayerUniform = this.layerCollection[key];
        //     if(layerUniform.name === layer.name) {
        //         layerIndex = Number(key);
        //         break;
        //     }
        // }
        if (layerIndex !== -1) {
            const layerUniform = this.layerCollection[layerIndex];
            layerUniform.blendMode = layer.blendMode//.valueOf();
            layerUniform.brightness = layer.brightness;
            layerUniform.exposure = layer.exposure;
            layerUniform.clipUv.x = layer.clipX;
            layerUniform.clipUv.y = layer.clipY;
            let c = new Color(layer.color);
            layerUniform.color.x = c.r;
            layerUniform.color.y = c.g;
            layerUniform.color.z = c.b;
            layerUniform.color.w = layer.opacity;
            layerUniform.contrast = layer.contrast;
            layerUniform.isHidden = layer.hidden;
            layerUniform.mapping = layer.projectionMapping//.valueOf();
            layerUniform.mirrorX = layer.mirrorX;
            layerUniform.mirrorY = layer.mirrorY;
            layerUniform.position.x = layer.longitude;
            layerUniform.position.y = layer.latitude;
            layerUniform.rotation = layer.rotation;
            layerUniform.size.x = layer.width;
            layerUniform.size.y = layer.height;
            layerUniform.textureEncoding = layer.texture.encoding ?? HDRLab.ThreeEncodingToLayerEncoding(layer.texture.value.encoding);
        }
    }
    refreshLayer(layer, property = "", value = undefined) {
        // if(property == "texture")
        //     this._refreshTextureForLayer(layer);
        this._refreshUniforms(layer);
        this._dirty = true;
        this.dispatchEvent({ type: 'layerUpdate', layer, property, value });
    }
    // private _refreshTextureForLayer(layer: LayerBase){
    //     const index = this.layers.indexOf(layer);
    //     let t = this.textureCollection[index];
    //     let t2 = layer.texture.value;
    //     if(!t2 || t == t2) return;
    //     this.textureCollection[index] = t2;
    // }
    removeTexture(layer) {
        // const index = this.layers.indexOf(layer);
        layer.texture.value = null;
        // this.textureCollection.splice(index, 1);
    }

    static ThreeEncodingToLayerEncoding(encoding) {
        switch (encoding) {
            case NoColorSpace:
            case LinearSRGBColorSpace:
                return LinearSRGBColorSpace;//LinearEncoding;
            case SRGBColorSpace:
                return sRGBEncoding;
            // case RGBEEncoding:
            //     return LayerTextureEncoding.RGBEEncoding;
            // case RGBM7Encoding:
            //     return LayerTextureEncoding.RGBM7Encoding;
            // case RGBM16Encoding:
            //     return LayerTextureEncoding.RGBM16Encoding;
            // case RGBDEncoding:
            //     return LayerTextureEncoding.RGBDEncoding;
            // case GammaEncoding:
            //     return LayerTextureEncoding.GammaEncoding;
            // case LogLuvEncoding:
            //     return LayerTextureEncoding.LogLuvEncoding;
            default:
                return sRGBEncoding;
        }
    }

    setTextureForLayer(imageUrl, layer) {

        let name = imageUrl.substring( imageUrl.lastIndexOf('/')+1, imageUrl.lastIndexOf('.') );
        let type = imageUrl.substring( imageUrl.lastIndexOf('.')+1 ).toLowerCase();

        if(type==="jpghdr"){ 
            imageUrl = imageUrl.substring( 0, imageUrl.length-3 );
            console.log(imageUrl)
        }
        
        let self = this
        let onTextureLoad = function (texture) {

            layer.texture = { value: texture, encoding: HDRLab.ThreeEncodingToLayerEncoding(texture.colorSpace), isCube: false };
            self._dirty = true
            // layer._textureUrl = value;
        };

       

        switch ( type ) {
            case "hdr":
            case "rgbe":
                if(_rgbeTextureLoader) _rgbeTextureLoader.load(imageUrl, value => {
                    value.image.srcUrl = imageUrl;
                    onTextureLoad(value);
                });
                break;
            case "jpghdr":
                if(_jpgHdrTextureLoader) _jpgHdrTextureLoader.load(imageUrl, (e) => {
                    //value.image.srcUrl = imageUrl;
                    //let tx = _jpgHdrTextureLoader.renderTarget.texture
                    //console.log(e.renderTarget.texture)
                    onTextureLoad(e.renderTarget.texture);
                });
                break;
            case "exr":
                if(_exrTextureLoader) _exrTextureLoader.load(imageUrl, value => {
                    value.image.srcUrl = imageUrl;
                    onTextureLoad(value);
                });
                break;
            case "env":
                if(_envTextureLoader) _envTextureLoader.load(imageUrl).then(value => {
                    // if(value.encoding !== LogLuvEncoding) { // todo; prefiltered env
                    //     value.encoding = sRGBEncoding;
                    // }
                    value.image.srcUrl = imageUrl;
                    onTextureLoad(value);
                });
                break;
            case "png":
            case "jpg":
            case "jpeg":
            default:
                _textureLoader.load(imageUrl, onTextureLoad);
            break;
        }
    }
}


HDRLab.dummyTexture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat, UnsignedByteType);
HDRLab.blackTexture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType);
HDRLab.black1x1Texture = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";


class LayerBase {
    addFilter(filter) {
        this._filters.push(filter);
        return filter;
    }
    removeFilter(filter) {
        let i = this._filters.indexOf(filter);
        if (i >= 0)
            this._filters.splice(i, 1);
    }
    addPropertyChangedCallback(c) {
        this._layerPropertyChangedCallbacks.push(c);
    }
    removePropertyChangedCallback(c) {
        this._layerPropertyChangedCallbacks.filter(value => value != c);
    }
    propertyChanged(property, value) {
        this._layerPropertyChangedCallbacks.forEach(callback => callback(this, property, value));
    }
    constructor(iLayer) {
        this._blendMode = AdditiveBlending;
        this._brightness = 0;
        this._exposure = 1;
        this._clipX = 0;
        this._clipY = 0;
        this._color = "#000000";
        this._contrast = 1;
        this._height = 0;
        this._hidden = false;
        this._latitude = 0;
        this._longitude = 0;
        this._mirrorX = false;
        this._mirrorY = false;
        this._opacity = 1;
        this._projectionMapping = ThreeD;
        this._rotation = 0;
        this._textureUrl = "";
        this._alphaTextureUrl = "";
        this._width = 0;
        this._textureType = "";
        //this._texture = { value: null, encoding: LinearEncoding };
        //this._alphaTexture = { value: null, encoding: LinearEncoding };
        this._texture = { value: null, encoding: 0 };
        this._alphaTexture = { value: null, encoding: 0 };
        this._preview = null;
        this._filters = [];
        this._layerPropertyChangedCallbacks = [];
        Object.assign(this, iLayer); //https://stackoverflow.com/questions/55583732/what-is-the-purpose-of-object-assign-in-the-constructor-of-a-typescript-object
    }
    dispose() {
    }
    serialize() {
        return {
            name: this.name,
            longitude: this.longitude,
            latitude: this.latitude,
            width: this.width,
            height: this.height,
            rotation: this.rotation,
            exposure: this.exposure,
            brightness: this.brightness,
            contrast: this.contrast,
            hidden: this.hidden,
            blendMode: this.blendMode,//.valueOf(),
            projectionMapping: this.projectionMapping,//.valueOf(),
            clipX: this.clipX,
            clipY: this.clipY,
            mirrorX: this.mirrorX,
            mirrorY: this.mirrorY,
            opacity: this.opacity,
            color: this.color,
            textureType: this.textureType,
            textureUrl: this.textureUrl,
            alphaTextureUrl: this.alphaTextureUrl,
            texture: this._texture.value ? this._texture : { value: null, encoding: 0 },
            alphaTexture: { value: null, encoding: 0 },
            preview: this.preview
        };
    }
    set blendMode(value) {
        this._blendMode = value;
        this.propertyChanged("blendMode", value);
    }
    set brightness(value) {
        this._brightness = value;
        this.propertyChanged("brightness", value);
    }
    set exposure(value) {
        this._exposure = value;
        this.propertyChanged("exposure", value);
    }
    set clipX(value) {
        this._clipX = value;
        this.propertyChanged("clipX", value);
    }
    set clipY(value) {
        this._clipY = value;
        this.propertyChanged("clipY", value);
    }
    set color(value) {
        this._color = value;
        this.propertyChanged("color", value);
    }
    set contrast(value) {
        this._contrast = value;
        this.propertyChanged("contrast", value);
    }
    set height(value) {
        this._height = value;
        this.propertyChanged("height", value);
    }
    set hidden(value) {
        this._hidden = value;
        this.propertyChanged("hidden", value);
    }
    set latitude(value) {
        this._latitude = value;
        this.propertyChanged("latitude", value);
    }
    set longitude(value) {
        this._longitude = value;
        this.propertyChanged("longitude", value);
    }
    set mirrorX(value) {
        this._mirrorX = value;
        this.propertyChanged("mirrorX", value);
    }
    set mirrorY(value) {
        this._mirrorY = value;
        this.propertyChanged("mirrorY", value);
    }
    set name(value) {
        this._name = value;
        this.propertyChanged("name", value);
    }
    set opacity(value) {
        this._opacity = value;
        this.propertyChanged("opacity", value);
    }
    set projectionMapping(value) {
        this._projectionMapping = value;
        this.propertyChanged("projectionMapping", value);
    }
    set rotation(value) {
        this._rotation = value;
        this.propertyChanged("rotation", value);
    }
    set textureUrl(value) {
        this._textureUrl = value;
        this.propertyChanged("textureUrl", value);
    }
    set alphaTextureUrl(value) {
        this._alphaTextureUrl = value;
        this.propertyChanged("textureUrl", value);
    }
    set preview(value) {
        this._preview = value;
    }
    set texture(value) {
        //this._texture = value || { value: null, encoding: LinearEncoding };
        this._texture = value || { value: null, encoding: 0 };
        this.propertyChanged("texture", value);
    }
    set alphaTexture(value) {
        //this._alphaTexture = value || { value: null, encoding: LinearEncoding };
        this._alphaTexture = value || { value: null, encoding: 0 };
        this.propertyChanged("alphaTexture", value);
    }
    set width(value) {
        this._width = value;
        this.propertyChanged("width", value);
    }
    set textureType(value) {
        this._textureType = value;
    }
    get blendMode() { return this._blendMode; }
    get isCubeTexture() {
        let tex = this.texture;
        let isCube = tex.isCube;
        return isCube == null && tex.value ? tex.value?.constructor?.name?.includes?.('Cube') ?? false : isCube;
    }
    get brightness() { return this._brightness; }
    get exposure() { return this._exposure; }
    get clipX() { return this._clipX; }
    get clipY() { return this._clipY; }
    get color() { return this._color; }
    get contrast() { return this._contrast; }
    get height() { return this._height; }
    get hidden() { return this._hidden; }
    get latitude() { return this._latitude; }
    get longitude() { return this._longitude; }
    get mirrorX() { return this._mirrorX; }
    get mirrorY() { return this._mirrorY; }
    get name() { return this._name; }
    get opacity() { return this._opacity; }
    get projectionMapping() { return this._projectionMapping; }
    get rotation() { return this._rotation; }
    get textureUrl() { return this._textureUrl; }
    get alphaTextureUrl() { return this._alphaTextureUrl; }
    get width() { return this._width; }
    get textureType() { return this._textureType; }
    get texture() { return this._texture; }
    get alphaTexture() { return this._alphaTexture;  }
    get preview() { return this._preview; }
    get filters() { return this._filters; }
}
class LayerThree extends LayerBase {

    constructor(iLayer) {
        super(iLayer);
        this.isLayerThree = true;
        this._blurParams = {
            x: 10,
            y: 10,
            enabled: false
        };
        delete this.blurParams;
        if (iLayer.blurParams) {
            this.setBlur(iLayer.blurParams);
        }

        //console.log(this._texture)
        // LayerThree._textureLoader.setCrossOrigin("");
        // LayerThree._rgbeTextureLoader.setCrossOrigin("");
        // LayerThree._exrTextureLoader.setCrossOrigin("");
    }
    setBlur(params) {
        /*Object.assign(this._blurParams, params);
        if (this._blurParams.enabled) {
            if (!this._hBlurFilter)
                this._hBlurFilter = this.addFilter(new _filters__WEBPACK_IMPORTED_MODULE_1__.HorizontalBlurFilterThree(this._blurParams.x));
            if (!this._vBlurFilter)
                this._vBlurFilter = this.addFilter(new _filters__WEBPACK_IMPORTED_MODULE_1__.VerticalBlurFilterThree(this._blurParams.y));
            this._hBlurFilter.intensity = this._blurParams.x;
            this._vBlurFilter.intensity = this._blurParams.y;
        } else {
            if (this._hBlurFilter) {
                this.removeFilter(this._hBlurFilter);
                this._hBlurFilter = undefined;
            }
            if (this._vBlurFilter) {
                this.removeFilter(this._vBlurFilter);
                this._vBlurFilter = undefined;
            }
        }
        this.propertyChanged("blurParams", params);*/
    }
    getBlur() {
        return this._blurParams;
    }
    serialize() {
        return { ...super.serialize(), blurParams: this._blurParams };
    }
}



const equiMapShader = {
    uniforms: {
        layer: { value: null },
        layerIndex: { value: 0 },
        layerTexture: { value: null },
        layerAlphaTexture: { value: null },
        baseTexture: { value: null },
    },
    defines: {
        PROJECTION_SPHERE_SIZE: 20.000001,
        PLANER_SIZE_MULTIPLIER: 2.5,
        BLEND: 1,
        CUBE_TEXTURE: 0,
        baseTextureEncoding: 0,
        ALPHA_TEXTURE: 0,
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4( position, 1.0 );
        }
    `,
    fragmentShader:/* glsl */`

        #define INFINITY 99999999.0
        #define EPSILON 0.0001
        #define BlendModeNone 0
        #define BlendModeAdd 2//1
        #define BlendModeMultiply 4//2
        #define BlendModeOver 1//3
        #define Mapping3D 0
        #define MappingPlaner 1
        struct LightLayer {
            vec2 position; //lattitude and longitude
            vec2 size; //width, height
            vec2 clipUv;
            vec4 color;
            float rotation;
            float brightness;
            float exposure;
            float contrast;
            int blendMode;
            int mapping;
            bool isHidden;
            bool mirrorX;
            bool mirrorY;
            int textureEncoding;
        };

        varying vec2 vUv;
        uniform LightLayer layer;
        uniform int layerIndex;
        #if CUBE_TEXTURE > 0
        uniform samplerCube layerTexture;
        #else
        uniform sampler2D layerTexture;
        uniform sampler2D layerAlphaTexture;
        #endif
        //#if BLEND > 0
        uniform sampler2D baseTexture;
        //#endif
        //uniform int baseTextureEncoding; // set with #define
        vec4 inputTexelToLinear(vec4 value, int inputEncoding){
            if(inputEncoding == 0){
                return value;
                //    }else if(inputEncoding == 1){
                //        return sRGBToLinear(value);
                //    }else if(inputEncoding == 2){
                //        return RGBEToLinear(value);
                //    }else if(inputEncoding == 3){
                //        return RGBMToLinear(value, 7.0);
                //    }else if(inputEncoding == 4){
                //        return RGBMToLinear(value, 16.0);
                //    }else if(inputEncoding == 5){
                //        return RGBDToLinear(value, 256.0);
                //    }else if(inputEncoding == 6){
                //        return GammaToLinear(value, 2.2);
                //    }else if(inputEncoding == 7){
                //        return LogLuvToLinear(value);
              }
              return value;
          }

          vec3 polar_to_3d(vec2 pc, float radius){
            vec2 theta = vec2(cos(radians(pc.x)), sin(radians(pc.x)));
            vec2 phi = vec2(cos(radians(pc.y)), sin(radians(pc.y)));
            vec3 res = vec3(theta.x*phi.x,theta.y*phi.x,phi.y);
            return res*radius;
        }

        vec3 plane_intersect(vec3 plane_normal, vec3 v0, vec3 ray_start, vec3 ray_dir){
            float den = dot(ray_dir, plane_normal);
            if(den<0.0) return vec3(INFINITY);
             return ray_start + ray_dir * dot(v0-ray_start, plane_normal)/den;
        }

        bool point_to_uv_in_rectangle(vec3 iPoint, vec3 p1, vec3 p2, vec3 p3, vec3 p4, out vec2 uv){
            vec3 top = p1-p2;
            vec3 bottom = p3-p4;
            vec3 left = p3-p1;
            vec3 right = p4-p2;

            vec4 d = vec4(
            length(cross(p1-iPoint, left))/length(left),
            length(cross(p4-iPoint, right))/length(right),
            length(cross(p1-iPoint, top))/length(top),
            length(cross(p3-iPoint, bottom))/length(bottom)
            );

            if(abs(d.x + d.y - length(top)) + abs(d.z + d.w - length(left)) > 0.001)
                return false;
            uv = vec2(d.x/(d.x+d.y), d.z/(d.z+d.w));
            return true;
        }


        bool intersect_layer(in LightLayer layer, in vec2 pos, out vec2 uv){
            layer.position.x = mod(layer.position.x, 360.0 + EPSILON);\
            layer.position.y = mod(layer.position.y+90.0, 180.0 + EPSILON)-90.0+EPSILON;
            vec3 plane_normal, intersection, plane_point, north, east;
            vec2 size = layer.size;
            float rotation = layer.rotation;

            if(layer.mapping == MappingPlaner){
                plane_point = vec3(layer.position.x, layer.position.y, 0);
                plane_normal = vec3(0,0,-1);
                east = vec3(-1,0,0);
                size *= PLANER_SIZE_MULTIPLIER;
                rotation = 180.0 + rotation;
                intersection = vec3(pos, 0);
            }else if(layer.mapping == Mapping3D){
                plane_point = polar_to_3d(layer.position, PROJECTION_SPHERE_SIZE);
                plane_normal = normalize(-plane_point);
                east = normalize(cross(vec3(0, 0.0, PROJECTION_SPHERE_SIZE) - plane_point, -plane_normal));
                if(length(east) < 1.0-EPSILON)
                    east = vec3(1,0,0);

                if(layer.mirrorX)
                    pos.x = mod(2.0*layer.position.x-pos.x, 360.0 + EPSILON);
                     if(layer.mirrorY)
                        pos.y = mod(2.0*(layer.position.y+90.0)-pos.y-90.0, 180.0 + EPSILON)-90.0;

                    vec3 r = polar_to_3d(pos, 1000.0);
                    intersection = plane_intersect(plane_normal, plane_point, r, -normalize(r));
                }

                float rad = radians(rotation);
                east = mix(plane_normal * dot(plane_normal, east), east, cos(rad)) + cross(plane_normal, east)*sin(rad);
                north = normalize(cross(east, -plane_normal));
                vec3 up = north * abs(size.y)/2.0;
                vec3 right = east * abs(size.x)/2.0;

                vec3 p1 = plane_point + up - right;
                vec3 p2 = plane_point + up + right;
                vec3 p3 = plane_point - up - right;
                vec3 p4 = plane_point - up + right;
                return point_to_uv_in_rectangle(intersection, p1, p2, p3, p4, uv);
            }

            float blend_overlay(float base, float blend) {
                return base<0.5?(2.0*base*blend):(1.0-2.0*(1.0-base)*(1.0-blend));
            }

            vec3 blend_layers(vec3 a1, vec3 a2, int blending){

                if(blending == BlendModeNone)
                    return a1;
                else if(blending == BlendModeAdd)
                    return a1 + a2;
                else if(blending == BlendModeMultiply)
                    return a1 * a2;
                else if(blending == BlendModeOver)
                    return vec3(blend_overlay(a2.r,a1.r),blend_overlay(a2.g,a1.g),blend_overlay(a2.b,a1.b));
                return a1 + a2;
            }

            void main(){
                //    #if BLEND < 0 // copy shader
                ////    if(layerIndex < 0){
                //        gl_FragColor = texture2D(baseTexture, vUv);
                //        return;
                ////    }
                //    #endif

                vec3 color = (layerIndex > 0 && BLEND > 0) ? inputTexelToLinear(texture2D(baseTexture, vUv), baseTextureEncoding).rgb : vec3(0);

                bool layerCheck = true;

                #if BLEND < 2
                vec2 uv;
                vec2 pos = vec2(vUv.x * 360.0, (vUv.y-0.5)*180.0);
                layerCheck = !layer.isHidden && intersect_layer(layer, pos, uv) && (uv.x > layer.clipUv.x && uv.y > layer.clipUv.y);
                #else
                vec4 pixelColor = texture2D(layerTexture, vUv);
                pixelColor = RGBEToLinear(pixelColor);
                layerCheck = length(pixelColor.rgb) > 0.;

                #endif

                if(layerCheck) {

                    #if BLEND < 2

                    #if CUBE_TEXTURE > 0
                    vec4 pixelColor = textureCubeLodEXT(layerTexture, polar_to_3d(pos.xy, 1000.).xzy, 0.);
                    #else
                    vec4 pixelColor = texture2D(layerTexture, uv);
                    #if ALPHA_TEXTURE > 0
                    pixelColor.a *= texture2D(layerAlphaTexture, uv).r;
                    #endif
                    #endif


                    pixelColor = layer.color * inputTexelToLinear(pixelColor, layer.textureEncoding);
                    pixelColor.rgb = (pixelColor.rgb - 0.5) * layer.contrast + 0.5;
                    pixelColor.rgb *= layer.exposure;
                    pixelColor.rgb += layer.brightness;
                    pixelColor.rgb = pixelColor.rgb * pixelColor.a;   //TODO: check if this is correct

                    #endif

                    #if BLEND > 0
                    color = blend_layers(pixelColor.rgb, color, layer.blendMode);
                    #else
                    color = pixelColor.rgb;
                    #endif
                }

                //vec4 res = LinearToRGBE(vec4(color, 0));
                vec4 res = vec4(color, 1.0);
                gl_FragColor = res;
            }

    `,
};



const CopyShader = {

    uniforms: {

        'tDiffuse': { value: null },
        'opacity': { value: 1.0 },
        'exposure': { value: 1.0 },
        'brightness': { value: 0.0 },
        'contrast': { value: 1.0 },
        // 'saturation': { value: 1.0 },
        // 'hue': { value: 0.0 },
        // 'gamma': { value: 1.0 },
        // 'vibrance': { value: 0.0 },

    },

    vertexShader: /* glsl */`

        varying vec2 vUv;

        void main() {

            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }`,

    fragmentShader: /* glsl */`

        uniform float opacity;
        uniform float exposure;
        uniform float brightness;
        uniform float contrast;
        uniform sampler2D tDiffuse;

        varying vec2 vUv;
        

        void main() {

            vec4 texel = texture2D( tDiffuse, vUv );
            gl_FragColor = opacity * texel;

           // gl_FragColor = texture2D( tDiffuse, vUv );
           // gl_FragColor.a *= opacity;
            
            gl_FragColor.rgb = (gl_FragColor.rgb - 0.5) * contrast + 0.5;
            gl_FragColor.rgb *= exposure;
            gl_FragColor.rgb += brightness;
            gl_FragColor.rgb = max(gl_FragColor.rgb, vec3(0.));

            //gl_FragColor = LinearToRGBM( gl_FragColor , 16.0);
            
            //#if defined(OUTPUT_ENCODING) && OUTPUT_ENCODING > 0
            //    #if OUTPUT_ENCODING == 1
            //    gl_FragColor = LinearToRGBM( gl_FragColor, 16.0 );
            //    #elif OUTPUT_ENCODING == 2
            //    gl_FragColor = LinearToRGBE( gl_FragColor );
            //    #endif
            //#else 
              //  #include <tonemapping_fragment>
            //    //#include <encodings_fragment>
              //  #include <colorspace_fragment>
            //#endif
            

        }`

};