// ==UserScript==
// @name        bilibili merged flv+mp4+ass+enhance
// @namespace   http://qli5.tk/
// @homepageURL https://github.com/liqi0816/bilitwin/
// @description bilibili/哔哩哔哩:超清FLV下载,FLV合并,原生MP4下载,弹幕ASS下载,播放体验增强,HTTPS,原生appsecret,不借助其他网站
// @include     http://www.bilibili.com/video/av*
// @include     https://www.bilibili.com/video/av*
// @include     http://bangumi.bilibili.com/anime/*/play*
// @include     https://bangumi.bilibili.com/anime/*/play*
// @version     1.3
// @author      qli5
// @copyright   qli5, 2014+, 田生, grepmusic
// @license     Mozilla Public License 2.0; http://www.mozilla.org/MPL/2.0/
// @run-at      document-begin
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

let debugOption = {
    // console会清空，生成 window.m 和 window.p
    //debug: 1,

    // 别拖啦~
    //betabeta: 1,

    // UP主不容易，B站也不容易，充电是有益的尝试，我不鼓励跳。
    //autoNextTimeout: 0,
};

/**
 * BiliTwin consist of two parts - BiliMonkey and BiliPolyfill. 
 * They are bundled because I am too lazy to write two user interfaces.
 * 
 * So what is the difference between BiliMonkey and BiliPolyfill?
 * 
 * BiliMonkey deals with network. It is a (naIve) Service Worker. 
 * This is also why it uses IndexedDB instead of localStorage.
 * BiliPolyfill deals with experience. It is more a "user script". 
 * Everything it can do can be done by hand.
 * 
 * BiliPolyfill will be pointless in the long run - I believe bilibili 
 * will finally provide these functions themselves.
 *  
 * This script is licensed under Mozilla Public License 2.0
 * https://www.mozilla.org/MPL/2.0/
 * 
 * Covered Software is provided under this License on an “as is” basis, 
 * without warranty of any kind, either expressed, implied, or statutory, 
 * including, without limitation, warranties that the Covered Software 
 * is free of defects, merchantable, fit for a particular purpose or 
 * non-infringing. The entire risk as to the quality and performance of 
 * the Covered Software is with You. Should any Covered Software prove 
 * defective in any respect, You (not any Contributor) assume the cost 
 * of any necessary servicing, repair, or correction. This disclaimer 
 * of warranty constitutes an essential part of this License. No use of 
 * any Covered Software is authorized under this License except under 
 * this disclaimer.
 * 
 * Under no circumstances and under no legal theory, whether tort 
 * (including negligence), contract, or otherwise, shall any Contributor, 
 * or anyone who distributes Covered Software as permitted above, be 
 * liable to You for any direct, indirect, special, incidental, or 
 * consequential damages of any character including, without limitation, 
 * damages for lost profits, loss of goodwill, work stoppage, computer 
 * failure or malfunction, or any and all other commercial damages or 
 * losses, even if such party shall have been informed of the possibility 
 * of such damages. This limitation of liability shall not apply to 
 * liability for death or personal injury resulting from such party’s 
 * negligence to the extent applicable law prohibits such limitation. 
 * Some jurisdictions do not allow the exclusion or limitation of 
 * incidental or consequential damages, so this exclusion and limitation 
 * may not apply to You.
 */

/**
 * BiliMonkey
 * A bilibili user script
 * by qli5 goodlq11[at](gmail|163).com
 * 
 * The FLV merge utility is a Javascript translation of 
 * https://github.com/grepmusic/flvmerge
 * by grepmusic
 * 
 * The ASS convert utility is a wrapper of
 * https://tiansh.github.io/us-danmaku/bilibili/
 * by tiansh
 * (This script is loaded dynamically so that updates can be applied 
 * instantly. If github gets blocked from your region, please give 
 * BiliMonkey::loadASSScript a new default src.)
 * （如果github被墙了，Ctrl+F搜索loadASSScript，给它一个新的网址。）
 * 
 * This script is licensed under Mozilla Public License 2.0
 * https://www.mozilla.org/MPL/2.0/
 */

/**
 * BiliPolyfill
 * A bilibili user script
 * by qli5 goodlq11[at](gmail|163).com
 * 
 * This script is licensed under Mozilla Public License 2.0
 * https://www.mozilla.org/MPL/2.0/
 */

class TwentyFourDataView extends DataView {
    constructor(...args) {
        if (TwentyFourDataView.es6) {
            super(...args);
        }
        else {
            // ES5 polyfill
            // It is dirty. Very dirty.
            if (TwentyFourDataView.es6 === undefined) {
                try {
                    TwentyFourDataView.es6 = 1;
                    return super(...args);
                }
                catch (e) {
                    if (e.name == 'TypeError') {
                        TwentyFourDataView.es6 = 0;
                        let setPrototypeOf = Object.setPrototypeOf || function (obj, proto) {
                            obj.__proto__ = proto;
                            return obj;
                        };
                        setPrototypeOf(TwentyFourDataView, Object);
                    }
                    else throw e;
                }
            }
            super();
            let _dataView = new DataView(...args);
            _dataView.getUint24 = TwentyFourDataView.prototype.getUint24;
            _dataView.setUint24 = TwentyFourDataView.prototype.setUint24;
            _dataView.indexOf = TwentyFourDataView.prototype.indexOf;
            return _dataView;
        }
    }

    getUint24(byteOffset, littleEndian) {
        if (littleEndian) throw 'littleEndian int24 not supported';
        let msb = this.getUint8(byteOffset);
        return (msb << 16 | this.getUint16(byteOffset + 1));
    }

    setUint24(byteOffset, value, littleEndian) {
        if (littleEndian) throw 'littleEndian int24 not supported';
        if (value > 0x00FFFFFF) throw 'setUint24: number out of range';
        let msb = value >> 16;
        let lsb = value & 0xFFFF;
        this.setUint8(byteOffset, msb);
        this.setUint16(byteOffset + 1, lsb);
    }

    indexOf(search, startOffset = 0, endOffset = this.byteLength - search.length + 1) {
        // I know it is NAIVE
        if (search.charCodeAt) {
            for (let i = startOffset; i < endOffset; i++) {
                if (this.getUint8(i) != search.charCodeAt(0)) continue;
                let found = 1;
                for (let j = 0; j < search.length; j++) {
                    if (this.getUint8(i + j) != search.charCodeAt(j)) {
                        found = 0;
                        break;
                    }
                }
                if (found) return i;
            }
            return -1;
        }
        else {
            for (let i = startOffset; i < endOffset; i++) {
                if (this.getUint8(i) != search[0]) continue;
                let found = 1;
                for (let j = 0; j < search.length; j++) {
                    if (this.getUint8(i + j) != search[j]) {
                        found = 0;
                        break;
                    }
                }
                if (found) return i;
            }
            return -1;
        }
    }
}

class FLVTag {
    constructor(dataView, currentOffset) {
        this.tagHeader = new TwentyFourDataView(dataView.buffer, dataView.byteOffset + currentOffset, 11);
        this.tagData = new TwentyFourDataView(dataView.buffer, dataView.byteOffset + currentOffset + 11, this.dataSize);
        this.previousSize = new TwentyFourDataView(dataView.buffer, dataView.byteOffset + currentOffset + 11 + this.dataSize, 4);
    }

    get tagType() {
        return this.tagHeader.getUint8(0);
    }

    get dataSize() {
        return this.tagHeader.getUint24(1);
    }

    get timestamp() {
        return this.tagHeader.getUint24(4);
    }

    get timestampExtension() {
        return this.tagHeader.getUint8(7);
    }

    get streamID() {
        return this.tagHeader.getUint24(8);
    }

    stripKeyframesScriptData() {
        let hasKeyframes = 'hasKeyframes\x01';
        let keyframes = '\x00\x09keyframs\x03';
        if (this.tagType != 0x12) throw 'can not strip non-scriptdata\'s keyframes';

        let index;
        index = this.tagData.indexOf(hasKeyframes);
        if (index != -1) {
            //0x0101 => 0x0100
            this.tagData.setUint8(index + hasKeyframes.length, 0x00);
        }

        // Well, I think it is unnecessary
        /*index = this.tagData.indexOf(keyframes)
        if (index != -1) {
            this.dataSize = index;
            this.tagHeader.setUint24(1, index);
            this.tagData = new TwentyFourDataView(this.tagData.buffer, this.tagData.byteOffset, index);
        }*/
    }

    getDuration() {
        if (this.tagType != 0x12) throw 'can not find non-scriptdata\'s duration';

        let duration = 'duration\x00';
        let index = this.tagData.indexOf(duration);
        if (index == -1) throw 'can not get flv meta duration';

        index += 9;
        return this.tagData.getFloat64(index);
    }

    getDurationAndView() {
        if (this.tagType != 0x12) throw 'can not find non-scriptdata\'s duration';

        let duration = 'duration\x00';
        let index = this.tagData.indexOf(duration);
        if (index == -1) throw 'can not get flv meta duration';

        index += 9;
        return {
            duration: this.tagData.getFloat64(index),
            durationDataView: new TwentyFourDataView(this.tagData.buffer, this.tagData.byteOffset + index, 8)
        };
    }

    getCombinedTimestamp() {
        return (this.timestampExtension << 24 | this.timestamp);
    }

    setCombinedTimestamp(timestamp) {
        if (timestamp < 0) throw 'timestamp < 0';
        this.tagHeader.setUint8(7, timestamp >> 24);
        this.tagHeader.setUint24(4, timestamp & 0x00FFFFFF);
    }
}

class FLV {
    constructor(dataView) {
        if (dataView.indexOf('FLV', 0, 1) != 0) throw 'Invalid FLV header';
        this.header = new TwentyFourDataView(dataView.buffer, dataView.byteOffset, 9);
        this.firstPreviousTagSize = new TwentyFourDataView(dataView.buffer, dataView.byteOffset + 9, 4);

        this.tags = [];
        let offset = this.headerLength + 4;
        while (offset < dataView.byteLength) {
            let tag = new FLVTag(dataView, offset);
            // debug for scrpit data tag
            // if (tag.tagType != 0x08 && tag.tagType != 0x09) 
            offset += 11 + tag.dataSize + 4;
            this.tags.push(tag);
        }

        if (offset != dataView.byteLength) throw 'FLV unexpected end of file';
    }

    get type() {
        return 'FLV';
    }

    get version() {
        return this.header.getUint8(3);
    }

    get typeFlag() {
        return this.header.getUint8(4);
    }

    get headerLength() {
        return this.header.getUint32(5);
    }

    static merge(flvs) {
        if (flvs.length < 1) throw 'Usage: FLV.merge([flvs])';
        let blobParts = [];
        let basetimestamp = [0, 0];
        let lasttimestamp = [0, 0];
        let duration = 0.0;
        let durationDataView;

        blobParts.push(flvs[0].header);
        blobParts.push(flvs[0].firstPreviousTagSize);

        for (let flv of flvs) {
            let bts = duration * 1000;
            basetimestamp[0] = lasttimestamp[0];
            basetimestamp[1] = lasttimestamp[1];
            bts = Math.max(bts, basetimestamp[0], basetimestamp[1]);
            let foundDuration = 0;
            for (let tag of flv.tags) {
                if (tag.tagType == 0x12 && !foundDuration) {
                    duration += tag.getDuration();
                    foundDuration = 1;
                    if (flv == flvs[0]) {
                        ({ duration, durationDataView } = tag.getDurationAndView());
                        tag.stripKeyframesScriptData();
                        blobParts.push(tag.tagHeader);
                        blobParts.push(tag.tagData);
                        blobParts.push(tag.previousSize);
                    }
                }
                else if (tag.tagType == 0x08 || tag.tagType == 0x09) {
                    lasttimestamp[tag.tagType - 0x08] = bts + tag.getCombinedTimestamp();
                    tag.setCombinedTimestamp(lasttimestamp[tag.tagType - 0x08]);
                    blobParts.push(tag.tagHeader);
                    blobParts.push(tag.tagData);
                    blobParts.push(tag.previousSize);
                }
            }
        }
        durationDataView.setFloat64(0, duration);

        return new Blob(blobParts);
    }

    static async mergeBlobs(blobs) {
        // Blobs can be swapped to disk, while Arraybuffers can not.
        // This is a RAM saving workaround. Somewhat.
        if (blobs.length < 1) throw 'Usage: FLV.mergeBlobs([blobs])';
        let resultParts = [];
        let basetimestamp = [0, 0];
        let lasttimestamp = [0, 0];
        let duration = 0.0;
        let durationDataView;

        for (let blob of blobs) {
            let bts = duration * 1000;
            basetimestamp[0] = lasttimestamp[0];
            basetimestamp[1] = lasttimestamp[1];
            bts = Math.max(bts, basetimestamp[0], basetimestamp[1]);
            let foundDuration = 0;

            let flv = await new Promise((resolve, reject) => {
                let fr = new FileReader();
                fr.onload = () => resolve(new FLV(new TwentyFourDataView(fr.result)));
                fr.readAsArrayBuffer(blob);
                fr.onerror = reject;
            });

            for (let tag of flv.tags) {
                if (tag.tagType == 0x12 && !foundDuration) {
                    duration += tag.getDuration();
                    foundDuration = 1;
                    if (blob == blobs[0]) {
                        resultParts.push(new Blob([flv.header, flv.firstPreviousTagSize]));
                        ({ duration, durationDataView } = tag.getDurationAndView());
                        tag.stripKeyframesScriptData();
                        resultParts.push(new Blob([tag.tagHeader]));
                        resultParts.push(tag.tagData);
                        resultParts.push(new Blob([tag.previousSize]));
                    }
                }
                else if (tag.tagType == 0x08 || tag.tagType == 0x09) {
                    lasttimestamp[tag.tagType - 0x08] = bts + tag.getCombinedTimestamp();
                    tag.setCombinedTimestamp(lasttimestamp[tag.tagType - 0x08]);
                    resultParts.push(new Blob([tag.tagHeader, tag.tagData, tag.previousSize]));
                }
            }
        }
        durationDataView.setFloat64(0, duration);

        return new Blob(resultParts);
    }
}

class CacheDB {
    constructor(dbName = 'biliMonkey', osName = 'flv', keyPath = 'name', maxItemSize = 100 * 1024 * 1024) {
        this.dbName = dbName;
        this.osName = osName;
        this.keyPath = keyPath;
        this.maxItemSize = maxItemSize;
        this.db = null;
    }

    async getDB() {
        if (this.db) return this.db;
        this.db = new Promise((resolve, reject) => {
            let openRequest = indexedDB.open(this.dbName);
            openRequest.onupgradeneeded = e => {
                let db = e.target.result;
                if (!db.objectStoreNames.contains(this.osName)) {
                    db.createObjectStore(this.osName, { keyPath: this.keyPath });
                }
            }
            openRequest.onsuccess = e => {
                resolve(this.db = e.target.result);
            }
            openRequest.onerror = reject;
        });
        return this.db;
    }

    async addData(item, name = item.name, data = item.data) {
        if (!data instanceof Blob) throw 'CacheDB: data must be a Blob';
        let db = await this.getDB();
        let itemChunks = [];
        let numChunks = Math.ceil(data.size / this.maxItemSize);
        for (let i = 0; i < numChunks; i++) {
            itemChunks.push({
                name: `${name}_part_${i}`,
                numChunks,
                data: data.slice(i * this.maxItemSize, (i + 1) * this.maxItemSize)
            });
        }
        let reqArr = [];
        for (let chunk of itemChunks) {
            reqArr.push(new Promise((resolve, reject) => {
                let req = db
                    .transaction([this.osName], 'readwrite')
                    .objectStore(this.osName)
                    .add(chunk);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        }

        return Promise.all(reqArr);
    }

    async putData(item, name = item.name, data = item.data) {
        if (!data instanceof Blob) throw 'CacheDB: data must be a Blob';
        let db = await this.getDB();
        let itemChunks = [];
        let numChunks = Math.ceil(data.size / this.maxItemSize);
        for (let i = 0; i < numChunks; i++) {
            itemChunks.push({
                name: `${name}_part_${i}`,
                numChunks,
                data: data.slice(i * this.maxItemSize, (i + 1) * this.maxItemSize)
            });
        }
        let reqArr = [];
        for (let chunk of itemChunks) {
            reqArr.push(new Promise((resolve, reject) => {
                let req = db
                    .transaction([this.osName], 'readwrite')
                    .objectStore(this.osName)
                    .put(chunk);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        }

        return Promise.all(reqArr);
    }

    async getData(index) {
        let db = await this.getDB();
        let item_0 = await new Promise((resolve, reject) => {
            let req = db
                .transaction([this.osName])
                .objectStore(this.osName)
                .get(`${index}_part_0`);
            req.onsuccess = () => resolve(req.result);
            req.onerror = reject;
        });
        if (!item_0) return undefined;
        let { numChunks, data: data_0 } = item_0;

        let reqArr = [Promise.resolve(data_0)];
        for (let i = 1; i < numChunks; i++) {
            reqArr.push(new Promise((resolve, reject) => {
                let req = db
                    .transaction([this.osName])
                    .objectStore(this.osName)
                    .get(`${index}_part_${i}`);
                req.onsuccess = () => resolve(req.result.data);
                req.onerror = reject;
            }));
        }

        let itemChunks = await Promise.all(reqArr);
        return { name: index, data: new Blob(itemChunks) };
    }

    async deleteData(index) {
        let db = await this.getDB();
        let item_0 = await new Promise((resolve, reject) => {
            let req = db
                .transaction([this.osName])
                .objectStore(this.osName)
                .get(`${index}_part_0`);
            req.onsuccess = () => resolve(req.result);
            req.onerror = reject;
        });
        if (!item_0) return undefined;
        let numChunks = item_0.numChunks;

        let reqArr = [];
        for (let i = 0; i < numChunks; i++) {
            reqArr.push(new Promise((resolve, reject) => {
                let req = db
                    .transaction([this.osName], 'readwrite')
                    .objectStore(this.osName)
                    .delete(`${index}_part_${i}`);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        }
        return Promise.all(reqArr);
    }

    async deleteEntireDB() {
        let req = indexedDB.deleteDatabase(this.dbName);
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(this.db = null);
            req.onerror = reject;
        });
    }
}

class DetailedFetchBlob {
    constructor(input, init = {}, onprogress = init.onprogress, onabort = init.onabort, onerror = init.onerror) {
        // Fire in the Fox fix
        if (this.firefoxConstructor(input, init, onprogress, onabort, onerror)) return;
        // Now I know why standardizing cancelable Promise is that difficult
        // PLEASE refactor me!
        this.onprogress = onprogress;
        this.onabort = onabort;
        this.onerror = onerror;
        this.abort = null;
        this.loaded = init.cacheLoaded || 0;
        this.total = init.cacheLoaded || 0;
        this.lengthComputable = false;
        this.buffer = [];
        this.blob = null;
        this.reader = null;
        this.blobPromise = fetch(input, init).then(res => {
            if (this.reader == 'abort') return res.body.getReader().cancel().then(() => null);
            if (!res.ok) throw `HTTP Error ${res.status}: ${res.statusText}`;
            this.lengthComputable = res.headers.has('Content-Length');
            this.total += parseInt(res.headers.get('Content-Length')) || Infinity;
            if (this.lengthComputable) {
                this.reader = res.body.getReader();
                return this.blob = this.consume();
            }
            else {
                if (this.onprogress) this.onprogress(this.loaded, this.total, this.lengthComputable);
                return this.blob = res.blob();
            }
        });
        this.blobPromise.then(() => this.abort = () => { });
        this.blobPromise.catch(e => this.onerror({ target: this, type: e }));
        this.promise = Promise.race([
            this.blobPromise,
            new Promise(resolve => this.abort = () => {
                this.onabort({ target: this, type: 'abort' });
                resolve('abort');
                this.buffer = [];
                this.blob = null;
                if (this.reader) this.reader.cancel();
                else this.reader = 'abort';
            })
        ]).then(s => s == 'abort' ? new Promise(() => { }) : s);
        this.then = this.promise.then.bind(this.promise);
        this.catch = this.promise.catch.bind(this.promise);
    }

    getPartialBlob() {
        return new Blob(this.buffer);
    }

    async getBlob() {
        return this.promise;
    }

    async pump() {
        while (true) {
            let { done, value } = await this.reader.read();
            if (done) return this.loaded;
            this.loaded += value.byteLength;
            this.buffer.push(new Blob([value]));
            if (this.onprogress) this.onprogress(this.loaded, this.total, this.lengthComputable);
        }
    }

    async consume() {
        await this.pump();
        this.blob = new Blob(this.buffer);
        this.buffer = null;
        return this.blob;
    }

    firefoxConstructor(input, init = {}, onprogress = init.onprogress, onabort = init.onabort, onerror = init.onerror) {
        if (top.navigator.userAgent.indexOf('Firefox') == -1) return false;
        this.onprogress = onprogress;
        this.onabort = onabort;
        this.onerror = onerror;
        this.abort = null;
        this.loaded = init.cacheLoaded || 0;
        this.total = init.cacheLoaded || 0;
        this.lengthComputable = false;
        this.buffer = [];
        this.blob = null;
        this.reader = undefined;
        this.blobPromise = new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.responseType = 'moz-chunked-arraybuffer';
            xhr.onload = () => { resolve(this.blob = new Blob(this.buffer)); this.buffer = null; }
            let cacheLoaded = this.loaded;
            xhr.onprogress = e => {
                this.loaded = e.loaded + cacheLoaded;
                this.total = e.total + cacheLoaded;
                this.lengthComputable = e.lengthComputable;
                this.buffer.push(new Blob([xhr.response]));
                if (this.onprogress) this.onprogress(this.loaded, this.total, this.lengthComputable);
            };
            xhr.onabort = e => this.onabort({ target: this, type: 'abort' });
            xhr.onerror = e => { this.onerror({ target: this, type: e.type }); reject(e); };
            this.abort = xhr.abort.bind(xhr);
            xhr.open('get', input);
            xhr.send();
        });
        this.promise = this.blobPromise;
        this.then = this.promise.then.bind(this.promise);
        this.catch = this.promise.catch.bind(this.promise);
        return true;

        /* ****obsolete****
        // Obsolete: moz-blob will drain your RAM
        this.onprogress = onprogress;
        this.onabort = onabort;
        this.onerror = onerror;
        this.abort = null;
        this.loaded = init.cacheLoaded || 0;
        this.total = init.cacheLoaded || 0;
        this.lengthComputable = false;
        this.buffer = null;
        this.blob = null;
        this.reader = undefined;
        this.blobPromise = new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.responseType = 'moz-blob';
            xhr.onload = () => resolve(this.blob = xhr.response);
            xhr.onloadstart = e => alert(`${e.loaded} ${e.total} ${e.lengthComputable}`);
            let cacheLoaded = this.loaded;
            xhr.onprogress = e => {
                this.loaded = e.loaded + cacheLoaded;
                this.total = e.total + cacheLoaded;
                this.lengthComputable = e.lengthComputable;
                this.onprogress(this.loaded, this.total, this.lengthComputable);
            };
            xhr.onabort = e => this.onabort({ target: this, type: 'abort' });
            xhr.onerror = e => { this.onerror({ target: this, type: e.type }); reject(e); };
            this.abort = () => { this.buffer = [xhr.response]; xhr.abort(); };
            xhr.open('get', input);
            xhr.send();
        });
        this.promise = this.blobPromise;
        this.then = this.promise.then.bind(this.promise);
        this.catch = this.promise.catch.bind(this.promise);
        return true;*/
    }
}

class Mutex {
    constructor() {
        this.queueTail = Promise.resolve();
        this.resolveHead = null;
    }

    async lock() {
        let myResolve;
        let _queueTail = this.queueTail;
        this.queueTail = new Promise(resolve => myResolve = resolve);
        await _queueTail;
        this.resolveHead = myResolve;
        return;
    }

    unlock() {
        this.resolveHead();
        return;
    }

    async lockAndAwait(asyncFunc) {
        await this.lock();
        let ret;
        try {
            ret = await asyncFunc();
        }
        finally {
            this.unlock();
        }
        return ret;
    }

    static _UNIT_TEST() {
        let m = new Mutex();
        function sleep(time) {
            return new Promise(r => setTimeout(r, time));
        }
        m.lockAndAwait(() => {
            console.warn('Check message timestamps.');
            console.warn('Bad:');
            console.warn('1 1 1 1 1:5s');
            console.warn(' 1 1 1 1 1:10s');
            console.warn('Good:');
            console.warn('1 1 1 1 1:5s');
            console.warn('         1 1 1 1 1:10s');
        });
        m.lockAndAwait(async () => {
            await sleep(1000);
            await sleep(1000);
            await sleep(1000);
            await sleep(1000);
            await sleep(1000);
        });
        m.lockAndAwait(async () => console.log('5s!'));
        m.lockAndAwait(async () => {
            await sleep(1000);
            await sleep(1000);
            await sleep(1000);
            await sleep(1000);
            await sleep(1000);
        });
        m.lockAndAwait(async () => console.log('10s!'));
    }
}

class AsyncContainer {
    // Yes, this is something like cancelable Promise. But I insist they are different.
    constructor() {
        //this.state = 0; // I do not know why will I need this.
        this.resolve = null;
        this.reject = null;
        this.hang = null;
        this.hangReturn = Symbol();
        this.primaryPromise = new Promise((s, j) => {
            this.resolve = arg => { s(arg); return arg; }
            this.reject = arg => { j(arg); return arg; }
        });
        //this.primaryPromise.then(() => this.state = 1);
        //this.primaryPromise.catch(() => this.state = 2);
        this.hangPromise = new Promise(s => this.hang = () => s(this.hangReturn));
        //this.hangPromise.then(() => this.state = 3);
        this.promise = Promise
            .race([this.primaryPromise, this.hangPromise])
            .then(s => s == this.hangReturn ? new Promise(() => { }) : s);
        this.then = this.promise.then.bind(this.promise);
        this.catch = this.promise.catch.bind(this.promise);
        this.destroiedThen = this.hangPromise.then.bind(this.hangPromise);
    }

    destroy() {
        this.hang();
        this.resolve = () => { };
        this.reject = this.resolve;
        this.hang = this.resolve;
        this.primaryPromise = null;
        this.hangPromise = null;
        this.promise = null;
        this.then = this.resolve;
        this.catch = this.resolve;
        this.destroiedThen = f => f();
        // Do NEVER NEVER NEVER dereference hangReturn.
        // Mysteriously this tiny symbol will keep you from Memory LEAK.
        //this.hangReturn = null;
    }

    static _UNIT_TEST() {
        let containers = [];
        async function foo() {
            let buf = new ArrayBuffer(600000000);
            let ac = new AsyncContainer();
            ac.destroiedThen(() => console.log('asyncContainer destroied'))
            containers.push(ac);
            await ac;
            return buf;
        }
        let foos = [foo(), foo(), foo()];
        containers.map(e => e.destroy());
        console.warn('Check your RAM usage. I allocated 1.8GB in three dead-end promises.')
        return [foos, containers];
    }
}

class BiliMonkey {
    constructor(playerWin, option = { cache: null, partial: false, proxy: false, blocker: false }) {
        this.playerWin = playerWin;
        this.protocol = playerWin.location.protocol;
        this.cid = null;
        this.flvs = null;
        this.mp4 = null;
        this.ass = null;
        this.cidAsyncContainer = new AsyncContainer();
        this.cidAsyncContainer.then(cid => { this.cid = cid; this.ass = this.getASS(); });
        if (typeof top.cid === 'string') this.cidAsyncContainer.resolve(top.cid);

        /* cache + proxy = Service Worker
         * Hope bilibili will have a SW as soon as possible.
         * partial = Stream
         * Hope the fetch API will be stabilized as soon as possible.
         * If you are using your grandpa's browser, do not enable these functions.
        **/
        this.cache = option.cache;
        this.partial = option.partial;
        this.proxy = option.proxy;
        this.blocker = option.blocker;
        this.option = option;
        if (this.cache && (!(this.cache instanceof CacheDB))) this.cache = new CacheDB('biliMonkey', 'flv', 'name');

        this.flvsDetailedFetch = [];
        this.flvsBlob = [];

        this.defaultFormatPromise = null;
        this.assAsyncScript = BiliMonkey.loadASSScript();
        this.queryInfoMutex = new Mutex();
        this.queryInfoMutex.lockAndAwait(() => this.getPlayer());
    }

    lockFormat(format) {
        // null => uninitialized
        // async pending => another one is working on it
        // async resolve => that guy just finished work
        // sync value => someone already finished work
        let h = this.playerWin.document.getElementsByClassName('bilibili-player-video-toast-top')[0];
        if (h) h.style.visibility = 'hidden';
        switch (format) {
            case 'flv':
                // Single writer is not a must.
                // Plus, if one writer failed, others should be able to overwrite its garbage.
                //if (this.flvs) return this.flvs; 
                return this.flvs = new AsyncContainer();
            case 'hdmp4':
                //if (this.mp4) return this.mp4;
                return this.mp4 = new AsyncContainer();
            case 'mp4':
                return;
            default:
                throw `lockFormat error: ${format} is a unrecognizable format`;
        }
    }

    resolveFormat(res, shouldBe) {
        let h = this.playerWin.document.getElementsByClassName('bilibili-player-video-toast-top')[0];
        if (h) {
            h.style.visibility = '';
            if (h.children.length) h.children[0].style.visibility = 'hidden';
            let i = () => {
                if (h.children.length) h.children[0].style.visibility = 'hidden';
                this.playerWin.document.getElementsByTagName('video')[0].removeEventListener('emptied', i);
            };
            let j = this.playerWin.document.getElementsByTagName('video')[0];
            if (j) j.addEventListener('emptied', i);
        }
        if (shouldBe && shouldBe != res.format) throw `URL interface error: response is not ${shouldBe}`;
        switch (res.format) {
            case 'flv':
                return this.flvs = this.flvs.resolve(res.durl.map(e => e.url.replace('http:', this.protocol)));
            case 'hdmp4':
                return this.mp4 = this.mp4.resolve(res.durl[0].url.replace('http:', this.protocol));
            case 'mp4':
                return;
            default:
                throw `resolveFormat error: ${res.format} is a unrecognizable format`;
        }
    }

    async execOptions() {
        if (this.cache) await this.cache.getDB();
        if (this.option.autoDefault) await this.sniffDefaultFormat();
        if (this.option.autoFLV) this.queryInfo('flv');
        if (this.option.autoMP4) this.queryInfo('mp4');
    }

    async sniffDefaultFormat() {
        if (this.defaultFormatPromise) return this.defaultFormatPromise;
        if (this.playerWin.document.querySelector('div.bilibili-player-video-btn.bilibili-player-video-btn-quality > div > ul > li:nth-child(2)')) return this.defaultFormatPromise = Promise.resolve();

        const jq = this.playerWin == window ? $ : this.playerWin.$;
        const _ajax = jq.ajax;
        const defquality = this.playerWin.localStorage && this.playerWin.localStorage.bilibili_player_settings ? JSON.parse(this.playerWin.localStorage.bilibili_player_settings).setting_config.defquality : undefined;

        this.defaultFormatPromise = new Promise(resolve => {
            let timeout = setTimeout(() => { jq.ajax = _ajax; resolve(); }, 5000);
            let self = this;
            jq.ajax = function (a, c) {
                if (c) { if (a) c.url = a; a = c };
                if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                    clearTimeout(timeout);
                    let format = a.url.match(/quality=\d*/)[0].slice(8);
                    format = format == 80 || format == 4 || format == 3 ? 'flv' : format == 2 || format == 48 ? 'hdmp4' : format == 1 || format == 16 ? 'mp4' : undefined;
                    if (!format) { console.error(`lockFormat error: ${a.url.match(/quality=\d*/)[0].slice(8)} is a unrecognizable format`); jq.ajax = _ajax; resolve(); return _ajax.call(jq, a, c); }
                    self.lockFormat(format);
                    self.cidAsyncContainer.resolve(a.url.match(/cid=\d+/)[0].slice(4));
                    let _success = a.success;
                    a.success = res => {
                        if (self.proxy && res.format == 'flv') {
                            self.resolveFormat(res, format);
                            self.setupProxy(res, _success);
                        }
                        else {
                            _success(res);
                            self.resolveFormat(res, format);
                        }
                        resolve(res);
                    };
                    jq.ajax = _ajax;
                }
                return _ajax.call(jq, a, c);
            };
        });
        return this.defaultFormatPromise;
    }

    async getSixteenMP4() {
        let src = this.playerWin.document.getElementsByTagName('video')[0].src;
        if (src.indexOf('.mp4') != -1) return Promise.resolve(src);
        const jq = this.playerWin == window ? $ : this.playerWin.$;
        const _ajax = jq.ajax;

        let pendingFormat = new AsyncContainer();
        let self = this;
        jq.ajax = function (a, c) {
            if (c) { if (a) c.url = a; a = c };
            if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                self.cidAsyncContainer.resolve(a.url.match(/cid=\d+/)[0].slice(4));
                let _success = a.success;
                _success({});
                a.success = res => pendingFormat.resolve(self.mp4 = res.durl[0].url.replace('http:', self.protocol));
                jq.ajax = _ajax;
            }
            return _ajax.call(jq, a, c);
        };
        this.playerWin.document.querySelector(`div.bilibili-player-video-btn-quality > div > ul > li:nth-child(4)`).click();
        return pendingFormat;
    }

    async getBackgroundFormat(format) {
        if (format == 'hdmp4') {
            let src = this.playerWin.document.getElementsByTagName('video')[0].src;
            if (src.indexOf('hd') != -1 && src.indexOf('.mp4') != -1) {
                let pendingFormat = this.lockFormat(format);
                this.resolveFormat({ durl: [{ url: src }] }, format);
                return pendingFormat;
            }
        }

        const jq = this.playerWin == window ? $ : this.playerWin.$;
        const _ajax = jq.ajax;

        let pendingFormat = this.lockFormat(format);
        let self = this;
        jq.ajax = function (a, c) {
            if (c) { if (a) c.url = a; a = c };
            if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                self.cidAsyncContainer.resolve(a.url.match(/cid=\d+/)[0].slice(4));
                let _success = a.success;
                a.success = res => {
                    if (format == 'hdmp4') res.durl = [res.durl[0].backup_url.find(e => e.indexOf('hd') != -1 && e.indexOf('.mp4') != -1)];
                    if (format == 'mp4') res.durl = [res.durl[0].backup_url.find(e => e.indexOf('hd') == -1 && e.indexOf('.mp4') != -1)];
                    self.resolveFormat(res, format);
                };
                jq.ajax = _ajax;
            }
            return _ajax.call(jq, a, c);
        };
        this.playerWin.player.reloadAccess();

        return pendingFormat;
    }

    async getCurrentFormat(format) {
        const jq = this.playerWin == window ? $ : this.playerWin.$;
        const _ajax = jq.ajax;
        const buttonNumber = format == 'flv' ? 1 : 2;
        const siblingFormat = format == 'flv' ? 'hdmp4' : 'flv';
        const trivialRes = { 'from': 'local', 'result': 'suee', 'format': siblingFormat, 'timelength': 10, 'accept_format': 'flv,hdmp4,mp4', 'accept_quality': [3, 2, 1], 'seek_param': 'start', 'seek_type': 'second', 'durl': [{ 'order': 1, 'length': 1000, 'size': 30000, 'url': '', 'backup_url': ['', ''] }] };

        let pendingSiblingFormat = this.lockFormat(siblingFormat);
        let self = this;
        jq.ajax = function (a, c) {
            if (c) { if (a) c.url = a; a = c };
            if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                self.cidAsyncContainer.resolve(a.url.match(/cid=\d+/)[0].slice(4));
                let _success = a.success;
                a.success = res => {
                    _success(res);
                    self.resolveFormat(res, siblingFormat);
                }
                jq.ajax = _ajax;
            }
            return _ajax.call(jq, a, c);
        };
        this.playerWin.document.querySelector(`div.bilibili-player-video-btn-quality > div > ul > li:nth-child(${3 - buttonNumber})`).click();
        await pendingSiblingFormat;

        await new Promise(resolve => {
            let video = this.playerWin.document.getElementsByTagName('video')[0];
            let h = () => {
                resolve();
                video.removeEventListener('emptied', h);
            };
            video.addEventListener('emptied', h);
        });

        let pendingFormat = this.lockFormat(format);
        jq.ajax = function (a, c) {
            if (c) { if (a) c.url = a; a = c };
            if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                self.cidAsyncContainer.resolve(a.url.match(/cid=\d+/)[0].slice(4));
                let _success = a.success;
                a.success = res => {
                    if (self.proxy && res.format == 'flv') {
                        self.resolveFormat(res, format);
                        self.setupProxy(res, _success);
                    }
                    else {
                        _success(res);
                        self.resolveFormat(res, format);
                    }
                };
                jq.ajax = _ajax;
            }
            return _ajax.call(jq, a, c);
        };
        this.playerWin.document.querySelector(`div.bilibili-player-video-btn-quality > div > ul > li:nth-child(${buttonNumber})`).click();

        return pendingFormat;
    }

    async getNonCurrentFormat(format) {
        const jq = this.playerWin == window ? $ : this.playerWin.$;
        const _ajax = jq.ajax;
        const buttonNumber = format == 'flv' ? 1 : 2;

        let pendingFormat = this.lockFormat(format);
        let self = this;
        jq.ajax = function (a, c) {
            if (c) { if (a) c.url = a; a = c };
            if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                self.cidAsyncContainer.resolve(a.url.match(/cid=\d+/)[0].slice(4));
                let _success = a.success;
                _success({});
                a.success = res => self.resolveFormat(res, format);
                jq.ajax = _ajax;
            }
            return _ajax.call(jq, a, c);
        };
        this.playerWin.document.querySelector(`div.bilibili-player-video-btn-quality > div > ul > li:nth-child(${buttonNumber})`).click();
        return pendingFormat;
    }

    async getASS(clickableFormat) {
        if (this.ass) return this.ass;
        this.ass = new Promise(async resolve => {
            if (!this.cid) this.cid = new Promise(resolve => {
                if (!clickableFormat) reject('get ASS Error: cid unavailable, nor clickable format given.');
                const jq = this.playerWin == window ? $ : this.playerWin.$;
                const _ajax = jq.ajax;
                const buttonNumber = clickableFormat == 'flv' ? 1 : 2;

                this.lockFormat(clickableFormat);
                let self = this;
                jq.ajax = function (a, c) {
                    if (c) { if (a) c.url = a; a = c };
                    if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                        resolve(self.cid = a.url.match(/cid=\d+/)[0].slice(4));
                        let _success = a.success;
                        _success({});
                        a.success = res => self.resolveFormat(res, clickableFormat);
                        jq.ajax = _ajax;
                    }
                    return _ajax.call(jq, a, c);
                };
                this.playerWin.document.querySelector(`div.bilibili-player-video-btn-quality > div > ul > li:nth-child(${buttonNumber})`).click();
            });
            let [{ fetchDanmaku, generateASS, setPosition }, cid] = await Promise.all([this.assAsyncScript, this.cid]);

            fetchDanmaku(cid, danmaku => {
                if (this.blocker) {
                    if (this.playerWin.localStorage.bilibili_player_settings) {
                        let regexps = new RegExp(JSON.parse(this.playerWin.localStorage.bilibili_player_settings).block.list.map(e => e.v).join('|'));
                        danmaku = danmaku.filter(d => !regexps.test(d.text));
                    }
                }
                let ass = generateASS(setPosition(danmaku), {
                    'title': document.title,
                    'ori': location.href,
                });
                // I would assume most users are using Windows
                let blob = new Blob(['\ufeff' + ass], { type: 'application/octet-stream' });
                resolve(this.ass = window.URL.createObjectURL(blob));
            });
        });
        return this.ass;
    }

    async queryInfo(format) {
        return this.queryInfoMutex.lockAndAwait(async () => {
            switch (format) {
                case 'flv':
                    if (this.flvs)
                        return this.flvs;
                    else if (this.playerWin.document.querySelector('div.bilibili-player-video-btn-quality > div > ul > li:nth-child(1)').getAttribute('data-selected'))
                        return this.getCurrentFormat('flv');
                    else
                        return this.getNonCurrentFormat('flv');
                case 'mp4':
                    if (this.mp4)
                        return this.mp4;
                    else if (this.playerWin.document.querySelector('div.bilibili-player-video-btn-quality > div > ul').children.length == 4)
                        return this.getSixteenMP4();
                    else if (this.playerWin.document.querySelector('div.bilibili-player-video-btn-quality > div > ul > li:nth-child(2)').getAttribute('data-selected'))
                        return this.getCurrentFormat('hdmp4');
                    else
                        return this.getNonCurrentFormat('hdmp4');
                case 'ass':
                    if (this.ass)
                        return this.ass;
                    else if (this.playerWin.document.querySelector('div.bilibili-player-video-btn-quality > div > ul > li:nth-child(1)').getAttribute('data-selected'))
                        return this.getASS('hdmp4');
                    else
                        return this.getASS('flv');
                default:
                    throw `Bilimonkey: What is format ${format}?`;
            }
        });
    }

    async getPlayer() {
        if (this.playerWin.document.querySelector('div.bilibili-player-video-btn.bilibili-player-video-btn-quality > div > ul > li:nth-child(2)')) {
            this.playerWin.document.getElementsByClassName('bilibili-player-video-panel')[0].style.display = 'none';
            return this.playerWin;
        }
        else if (MutationObserver) {
            return new Promise(resolve => {
                let observer = new MutationObserver(() => {
                    if (this.playerWin.document.querySelector('div.bilibili-player-video-btn.bilibili-player-video-btn-quality > div > ul > li:nth-child(2)')) {
                        observer.disconnect();
                        this.playerWin.document.getElementsByClassName('bilibili-player-video-panel')[0].style.display = 'none';
                        resolve(this.playerWin);
                    }
                });
                observer.observe(this.playerWin.document.getElementById('bilibiliPlayer'), { childList: true });
            });
        }
        else {
            return new Promise(resolve => {
                let t = setInterval(() => {
                    if (this.playerWin.document.querySelector('div.bilibili-player-video-btn.bilibili-player-video-btn-quality > div > ul > li:nth-child(2)')) {
                        clearInterval(t);
                        this.playerWin.document.getElementsByClassName('bilibili-player-video-panel')[0].style.display = 'none';
                        resolve(this.playerWin);
                    }
                }, 600);
            });
        }
    }

    async hangPlayer() {
        await this.getPlayer();

        let trivialRes = { 'from': 'local', 'result': 'suee', 'format': 'hdmp4', 'timelength': 10, 'accept_format': 'flv,hdmp4,mp4', 'accept_quality': [3, 2, 1], 'seek_param': 'start', 'seek_type': 'second', 'durl': [{ 'order': 1, 'length': 1000, 'size': 30000, 'url': '', 'backup_url': ['', ''] }] };
        const qualityToFormat = ['mp4', 'hdmp4', 'flv'];
        const jq = this.playerWin == window ? $ : this.playerWin.$;
        const _ajax = jq.ajax;

        return new Promise(async resolve => {
            let blockerTimeout;
            jq.ajax = function (a, c) {
                if (c) { if (a) c.url = a; a = c };
                if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                    clearTimeout(blockerTimeout);
                    trivialRes.format = qualityToFormat[a.url.match(/quality=(\d)/)[1]];
                    a.success(trivialRes);
                    blockerTimeout = setTimeout(() => {
                        jq.ajax = _ajax;
                        resolve();
                    }, 2500);
                }
                else {
                    return _ajax.call(jq, a, c);
                }
            };
            let button = Array
                .from(this.playerWin.document.querySelector('div.bilibili-player-video-btn.bilibili-player-video-btn-quality > div > ul').children)
                .find(e => !e.getAttribute('data-selected'));
            button.click();
        });

        /* ****obsolete****
        // Obsolete: I found a less destructive way
        return new Promise(async resolve => {
            // Magic number. Do not know why.
            for (let i = 0; i < 5; i++) {
                let trivialResSent = new Promise(r => {
                    jq.ajax = function (a, c) {
                        if (c) { if (a) c.url = a; a = c };
                        if (a.url.indexOf('interface.bilibili.com/playurl?') != -1 || a.url.indexOf('bangumi.bilibili.com/player/web_api/playurl?') != -1) {
                            // Send back a fake response to abort current loading.
                            trivialRes.format = qualityToFormat[a.url.match(/quality=(\d)/)[1]];
                            a.success(trivialRes);
                            // Requeue. Again, magic number.
                            setTimeout(r, 400);
                        }
                        else {
                            return _ajax.call(jq, a, c);
                        }
                    };

                })
                // Find a random available button
                let button = Array
                    .from(this.playerWin.document.querySelector('div.bilibili-player-video-btn.bilibili-player-video-btn-quality > div > ul').children)
                    .find(e => !e.getAttribute('data-selected'));
                button.click();
                await trivialResSent;
            }
            resolve(this.playerWin.document.querySelector('#bilibiliPlayer video'));
            jq.ajax = _ajax;
        });*/
    }

    async loadFLVFromCache(index) {
        if (!this.cache) return;
        if (!this.flvs) throw 'BiliMonkey: info uninitialized';
        let name = this.flvs[index].match(/\d+-\d+.flv/)[0];
        let item = await this.cache.getData(name);
        if (!item) return;
        return this.flvsBlob[index] = item.data;
    }

    async loadPartialFLVFromCache(index) {
        if (!this.cache) return;
        if (!this.flvs) throw 'BiliMonkey: info uninitialized';
        let name = this.flvs[index].match(/\d+-\d+.flv/)[0];
        name = 'PC_' + name;
        let item = await this.cache.getData(name);
        if (!item) return;
        return item.data;
    }

    async loadAllFLVFromCache() {
        if (!this.cache) return;
        if (!this.flvs) throw 'BiliMonkey: info uninitialized';

        let promises = [];
        for (let i = 0; i < this.flvs.length; i++) promises.push(this.loadFLVFromCache(i));

        return Promise.all(promises);
    }

    async saveFLVToCache(index, blob) {
        if (!this.cache) return;
        if (!this.flvs) throw 'BiliMonkey: info uninitialized';
        let name = this.flvs[index].match(/\d+-\d+.flv/)[0];
        return this.cache.addData({ name, data: blob });
    }

    async savePartialFLVToCache(index, blob) {
        if (!this.cache) return;
        if (!this.flvs) throw 'BiliMonkey: info uninitialized';
        let name = this.flvs[index].match(/\d+-\d+.flv/)[0];
        name = 'PC_' + name;
        return this.cache.putData({ name, data: blob });
    }

    async cleanPartialFLVInCache(index) {
        if (!this.cache) return;
        if (!this.flvs) throw 'BiliMonkey: info uninitialized';
        let name = this.flvs[index].match(/\d+-\d+.flv/)[0];
        name = 'PC_' + name;
        return this.cache.deleteData(name);
    }

    async getFLV(index, progressHandler) {
        if (this.flvsBlob[index]) return this.flvsBlob[index];

        if (!this.flvs) throw 'BiliMonkey: info uninitialized';
        this.flvsBlob[index] = (async () => {
            let cache = await this.loadFLVFromCache(index);
            if (cache) return this.flvsBlob[index] = cache;
            let partialCache = await this.loadPartialFLVFromCache(index);

            let burl = this.flvs[index];
            if (partialCache) burl += `&bstart=${partialCache.size}`;
            let opt = {
                method: 'GET',
                mode: 'cors',
                cache: 'default',
                referrerPolicy: 'no-referrer-when-downgrade',
                cacheLoaded: partialCache ? partialCache.size : 0,
                headers: partialCache && (burl.indexOf('wsTime') == -1) ? { Range: `bytes=${partialCache.size}-` } : undefined
            };
            opt.onprogress = progressHandler;
            opt.onerror = opt.onabort = ({ target, type }) => {
                let pBlob = target.getPartialBlob();
                if (partialCache) pBlob = new Blob([partialCache, pBlob]);
                this.savePartialFLVToCache(index, pBlob);
            }

            let fch = new DetailedFetchBlob(burl, opt);
            this.flvsDetailedFetch[index] = fch;
            let fullResponse = await fch.getBlob();
            this.flvsDetailedFetch[index] = undefined;
            if (partialCache) {
                fullResponse = new Blob([partialCache, fullResponse]);
                this.cleanPartialFLVInCache(index);
            }
            this.saveFLVToCache(index, fullResponse);
            return (this.flvsBlob[index] = fullResponse);

            /* ****obsolete****
            // Obsolete: cannot save partial blob
            let xhr = new XMLHttpRequest();
            this.flvsXHR[index] = xhr;
            xhr.onload = () => {
                let fullResponse = xhr.response;
                if (partialCache) fullResponse = new Blob([partialCache, xhr.response]);
                this.saveFLVToCache(index, fullResponse);
                resolve(this.flvsBlob[index] = fullResponse);
            }
            xhr.onerror = reject;
            xhr.onabort = () => {
                this.savePartialFLVToCache(index, xhr);
            }
            xhr.onprogress = event => progressHandler(event.loaded, event.total, index);
            xhr.onreadystatechange = () => {
                if (this.readyState == this.HEADERS_RECEIVED) {
                    console.log(`Size of ${index}: ${xhr.getResponseHeader('Content-Length')}`);
                }
            }
            xhr.responseType = 'blob';
            xhr.open('GET', this.flvs[index], true);
            if (partialCache) {
                xhr.setRequestHeader('Range', `bytes=${partialCache.size}-`);
            }
            xhr.send();*/
        })();
        return this.flvsBlob[index];
    }

    async abortFLV(index) {
        if (this.flvsDetailedFetch[index]) return this.flvsDetailedFetch[index].abort();
    }

    async getAllFLVs(progressHandler) {
        if (!this.flvs) throw 'BiliMonkey: info uninitialized';
        let promises = [];
        for (let i = 0; i < this.flvs.length; i++) promises.push(this.getFLV(i, progressHandler));
        return Promise.all(promises);
    }

    async cleanAllFLVsInCache() {
        if (!this.cache) return;
        if (!this.flvs) throw 'BiliMonkey: info uninitialized';
        let promises = [];
        for (let flv of this.flvs) {
            let name = flv.match(/\d+-\d+.flv/)[0];
            promises.push(this.cache.deleteData(name));
            promises.push(this.cache.deleteData('PC_' + name));
        }
        return Promise.all(promises);
    }

    async setupProxy(res, onsuccess) {
        (() => {
            let _fetch = this.playerWin.fetch;
            this.playerWin.fetch = function (input, init) {
                if (!input.slice || input.slice(0, 5) != 'blob:') {
                    return _fetch(input, init);
                }
                let bstart = input.indexOf('?bstart=');
                if (bstart < 0) {
                    return _fetch(input, init);
                }
                if (!init.headers instanceof Headers) init.headers = new Headers(init.headers || {});
                init.headers.set('Range', `bytes=${input.slice(bstart + 8)}-`);
                return _fetch(input.slice(0, bstart), init)
            }
        })();
        await this.loadAllFLVFromCache();
        let resProxy = {};
        Object.assign(resProxy, res);
        for (let i = 0; i < this.flvsBlob.length; i++) {
            if (this.flvsBlob[i]) resProxy.durl[i].url = this.playerWin.URL.createObjectURL(this.flvsBlob[i]);
        }
        return onsuccess(resProxy);
    }

    static async loadASSScript(src = 'https://tiansh.github.io/us-danmaku/bilibili/bilibili_ASS_Danmaku_Downloader.user.js') {
        let script = await new Promise((resolve, reject) => {
            let req = new XMLHttpRequest();
            req.onload = () => resolve(req.responseText);
            req.onerror = reject;
            req.open('get', src);
            req.send();
        });
        script = script.slice(0, script.indexOf('var init = function ()'));
        let head = `
        (function () {
        `;
        let foot = `
            fetchXML = function (cid, callback) {
                var oReq = new XMLHttpRequest();
                oReq.open('GET', 'https://comment.bilibili.com/{{cid}}.xml'.replace('{{cid}}', cid));
                oReq.onload = function () {
                    var content = oReq.responseText.replace(/(?:[\0-\x08\x0B\f\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/g, "");
                    callback(content);
                };
                oReq.send();
            };
            initFont();
            return { fetchDanmaku: fetchDanmaku, generateASS: generateASS, setPosition: setPosition };
        })()
        `;
        script = `${head}${script}${foot}`;
        let indirectEvalWrapper = { 'eval': eval };
        return indirectEvalWrapper.eval(script);
    }

    static _UNIT_TEST() {
        (async () => {
            let playerWin = await BiliUserJS.getPlayerWin();
            window.m = new BiliMonkey(playerWin);

            console.warn('sniffDefaultFormat test');
            await m.sniffDefaultFormat();
            console.log(m);

            console.warn('data race test');
            m.queryInfo('mp4');
            console.log(m.queryInfo('mp4'));

            console.warn('getNonCurrentFormat test');
            console.log(await m.queryInfo('mp4'));

            console.warn('getCurrentFormat test');
            console.log(await m.queryInfo('flv'));

            //location.reload();
        })();
    }
}

class BiliPolyfill {
    constructor(playerWin,
        option = {
            setStorage: (n, i) => playerWin.localStorage.setItem(n, i),
            getStorage: n => playerWin.localStorage.getItem(n),
            dblclick: true,
            scroll: true,
            recommend: true,
            autoNext: true,
            autoNextTimeout: 2000,
            lift: true,
            autoResume: true,
            autoPlay: false,
            autoFullScreen: false,
            oped: true,
            speech: false,
            series: true,
        }, hintInfo = () => { }) {
        this.playerWin = playerWin;
        this.video = null;
        this.vanillaPlayer = null;
        this.option = option;
        this.setStorage = option.setStorage;
        this.getStorage = option.getStorage;
        this.hintInfo = hintInfo;
        this.autoNextDestination = null;
        this.autoNextTimeout = option.autoNextTimeout;
        this.series = [];
        this.userdata = null;
    }

    saveUserdata() {
        this.setStorage('biliPolyfill', JSON.stringify(this.userdata));
    }

    retriveUserdata() {
        try {
            this.userdata = this.getStorage('biliPolyfill');
            if (this.userdata.length > 1073741824) top.alert('BiliPolyfill脚本数据已经快满了，在播放器上右键->BiliPolyfill->片头片尾->检视数据，删掉一些吧。');
            this.userdata = JSON.parse(this.userdata);
        }
        catch (e) { }
        finally {
            if (!this.userdata) this.userdata = {};
            if (!(this.userdata.oped instanceof Object)) this.userdata.oped = {};
        }
    }

    async setFunctions() {
        this.retriveUserdata();
        this.video = await this.getPlayerVideo();
        if (!this.option.betabeta) return this.autoNextDestination = '到设置开启';
        if (this.option.dblclick) this.dblclickFullScreen();
        if (this.option.scroll) this.scrollToPlayer();
        if (this.option.recommend) this.showRecommendTab();
        if (this.option.autoNext) this.autoNext();
        if (this.option.lift) this.liftBottomDanmuku();
        if (this.option.autoResume) this.autoResume();
        if (this.option.autoPlay) this.autoPlay();
        if (this.option.autoFullScreen) this.autoFullScreen();
        if (this.option.oped) this.skipOPED();
        let h = () => this.saveUserdata();
        this.playerWin.addEventListener('beforeunload', h);
        this.video.addEventListener('emptied', () => { this.playerWin.removeEventListener('beforeunload', h); this.option.scroll = undefined; this.setFunctions(); });
        // beta
        if (this.option.speech) top.document.body.addEventListener('click', e => e.detail > 2 ? this.speechRecognition() : undefined);
        if (this.option.series) this.inferNextInSeries();
    }

    async inferNextInSeries() {
        let title = top.document.getElementsByClassName('v-title')[0].textContent;
        if (this.playerWin.pageno && this.playerWin.pageno != 1) {
            let h = title.lastIndexOf(`(${this.playerWin.pageno})`);
            if (h != -1) {
                title = title.slice(0, h);
            }
        }

        // 1. Find series name
        let epNumberText = title.match(/\d+/g);
        if (!epNumberText) return this.series = [];
        epNumberText = epNumberText.pop();
        let seriesTitle = title.slice(0, title.lastIndexOf(epNumberText)).trim();
        // 2. Substitude ep number
        let ep = parseInt(epNumberText);
        if (epNumberText === '09') ep = [`08`, `10`];
        else if (epNumberText[0] === '0') ep = [`0${ep - 1}`, `0${ep + 1}`];
        else ep = [`${ep - 1}`, `${ep + 1}`];
        ep = [...ep.map(e => seriesTitle + e), ...ep];

        let mid = top.document.getElementById('r-info-rank').children[0].href.match(/\d+/)[0];
        let vlist = await Promise.all([title, ...ep].map(keyword => new Promise((resolve, reject) => {
            let req = new XMLHttpRequest();
            req.onload = () => resolve((req.response.status && req.response.data.vlist) || []);
            req.onerror = reject;
            req.open('get', `https://space.bilibili.com/ajax/member/getSubmitVideos?mid=${mid}&keyword=${keyword}`);
            req.responseType = 'json';
            req.send();
        })));

        vlist[0] = [vlist[0].find(e => e.title == title)];
        this.series = [vlist[1].find(e => e.created < vlist[0][0].created), vlist[2].reverse().find(e => e.created > vlist[0][0].created)];
        if (!this.series[0]) this.series[0] = vlist[3].find(e => e.created < vlist[0][0].created) || null;
        if (!this.series[1]) this.series[1] = vlist[4].reverse().find(e => e.created > vlist[0][0].created) || null;

        return this.series;
    }

    dblclickFullScreen() {
        this.video.addEventListener('dblclick', () =>
            this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-btn-fullscreen').click()
        );
    }

    scrollToPlayer() {
        if (top.scrollY < 200) top.document.getElementById('bofqi').scrollIntoView();
    }

    showRecommendTab() {
        this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-filter-btn-recommend').click();
    }

    getCoverImage() {
        if (top.document.querySelector('.cover_image'))
            return top.document.querySelector('.cover_image').src;
        else if (top.document.querySelector('div.v1-bangumi-info-img > a > img'))
            return top.document.querySelector('div.v1-bangumi-info-img > a > img').src.slice(0, top.document.querySelector('div.v1-bangumi-info-img > a > img').src.indexOf('.jpg') + 4);
        else
            return null;
    }

    autoNext() {
        // 1 Next Part
        // // 2 Watch Later: how to cooperate with bilibili's vanilla watchlater? it is more a playlist
        // 3 Recommendations
        if (this.autoNextDestination && this.autoNextDestination != '没有了') return;
        let destination, nextLocation;
        if (!nextLocation && top.location.host == 'bangumi.bilibili.com') {
            destination = '下一P'; //番剧:
            nextLocation = (nextLocation = top.document.querySelector('ul.slider-list .cur + li')) ? () => nextLocation.click() : undefined;
        }
        if (!nextLocation) {
            destination = '下一P'; //视频:
            nextLocation = (nextLocation = this.playerWin.document.querySelector('#plist .curPage + a')) ?
                this.playerWin.player.next instanceof Function ? this.playerWin.player.next : nextLocation.href : undefined;
        }
        if (!nextLocation) {
            destination = '稍后观看'; //列表:
            nextLocation = (nextLocation = this.playerWin.document.querySelector('li.bilibili-player-watchlater-item[data-state-play="true"] + li')) ?
                this.playerWin.player.next instanceof Function ?
                    this.playerWin.player.next : `https://www.bilibili.com/watchlater/#/av${nextLocation.getAttribute('data-aid')}` : undefined;
        }
        if (!nextLocation) {
            destination = 'B站推荐'; //列表:
            nextLocation = this.option.autoNextRecommend ? (nextLocation = this.playerWin.document.querySelector('div.bilibili-player-recommend a')) ?
                nextLocation.href : undefined : undefined;
        }
        if (!nextLocation) return this.autoNextDestination = '没有了';

        let h = () => {
            this.hintInfo(`BiliPolyfill: ${BiliPolyfill.secondToReadable(this.autoNextTimeout / 1000)}后播放下一个(任意点击取消)`);
            let t = setTimeout(() => nextLocation instanceof Function ? nextLocation() : top.window.location.assign(nextLocation), this.autoNextTimeout);
            let ht = () => { clearTimeout(t); this.playerWin.removeEventListener('click', ht); }
            setTimeout(() => this.playerWin.addEventListener('click', ht), 0);
            this.video.removeEventListener('ended', h);
        };
        this.video.addEventListener('ended', h);
        return this.autoNextDestination = destination;
    }

    liftBottomDanmuku() {
        if (!this.playerWin.document.getElementsByName('ctlbar_danmuku_prevent')[0].checked)
            this.playerWin.document.getElementsByName('ctlbar_danmuku_prevent')[0].click();
    }

    loadOffineSubtitles() {
        // NO. NOBODY WILL NEED THIS。
        // Hint: https://github.com/jamiees2/ass-to-vtt
        throw 'Not implemented';
    }

    autoResume() {
        let h = () => {
            if (this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-toast-bottom div.bilibili-player-video-toast-item')) {
                let [min, sec] = this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-toast-bottom div.bilibili-player-video-toast-item-text').children[1].textContent.split(':');
                let time = parseInt(min) * 60 + parseInt(sec);
                if (time < this.video.duration - 10) {
                    this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-toast-bottom div.bilibili-player-video-toast-item-jump').click();
                    setTimeout(() => {
                        if (!this.video.autoplay && !this.video.paused) this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-btn').click();
                    }, 0);
                }
                else {
                    this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-toast-bottom div.bilibili-player-video-toast-item-close').click();
                }
            }
        };
        this.video.addEventListener('canplay', h);
        setTimeout(() => this.video.removeEventListener('canplay', h), 5000);
    }

    autoPlay() {
        this.video.autoplay = true;
        if (this.video.paused)
            setTimeout(() => this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-btn').click(), 0);
    }

    autoFullScreen() {
        if (this.playerWin.document.querySelector('#bilibiliPlayer div.video-state-fullscreen-off'))
            this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-btn-fullscreen').click();
    }

    getCollectionId() {
        return (top.location.pathname.match(/av\d+/) || top.location.pathname.match(/anime\/\d+/))[0];
    }

    markOPPosition() {
        let collectionId = this.getCollectionId();
        if (!(this.userdata.oped[collectionId] instanceof Array)) this.userdata.oped[collectionId] = [];
        this.userdata.oped[collectionId][0] = this.video.currentTime;
    }

    markEDPostion() {
        let collectionId = this.getCollectionId();
        if (!(this.userdata.oped[collectionId] instanceof Array)) this.userdata.oped[collectionId] = [];
        this.userdata.oped[collectionId][1] = (this.video.currentTime);
    }

    clearOPEDPosition() {
        let collectionId = this.getCollectionId();
        this.userdata.oped[collectionId] = undefined;
    }

    skipOPED() {
        let collectionId = this.getCollectionId();
        if (!(this.userdata.oped[collectionId] instanceof Array)) return;
        if (this.userdata.oped[collectionId][0]) {
            if (this.video.currentTime < this.userdata.oped[collectionId][0]) {
                this.video.currentTime = this.userdata.oped[collectionId][0];
                this.hintInfo('BiliPolyfill: 已跳过片头');
            }
        }
        if (this.userdata.oped[collectionId][1]) {
            let edHandler = v => {
                if (v.target.currentTime > this.userdata.oped[collectionId][1]) {
                    v.target.removeEventListener('timeupdate', edHandler);
                    v.target.dispatchEvent(new Event('ended'));
                }
            }
            this.video.addEventListener('timeupdate', edHandler);
        }
    }

    setVideoSpeed(speed) {
        if (speed < 0 || speed > 10) return;
        this.video.playbackRate = speed;
    }

    speechRecognition() {
        let r, g;
        try { [r, g] = [SpeechRecognition, SpeechGrammarList] } catch (e) {
            try { [r, g] = [webkitSpeechRecognition, webkitSpeechGrammarList] } catch (e) { }
        }
        let [SpeechRecognition, SpeechGrammarList] = [r, g];
        alert('Yahaha! You found me!\nBiliTwin支持的语音命令: 播放 暂停 全屏 关闭 加速 减速 下一集\nChrome may support Cantonese or Hakka as well. See BiliPolyfill::speechRecognition.');
        if (!SpeechRecognition || !SpeechGrammarList) alert('浏览器太旧啦~彩蛋没法运行~');
        let player = ['播放', '暂停', '全屏', '关闭', '加速', '减速', '下一集'];
        let grammar = '#JSGF V1.0; grammar player; public <player> = ' + player.join(' | ') + ' ;';
        let recognition = new SpeechRecognition();
        let speechRecognitionList = new SpeechGrammarList();
        speechRecognitionList.addFromString(grammar, 1);
        recognition.grammars = speechRecognitionList;
        // cmn: Mandarin(Putonghua), yue: Cantonese, hak: Hakka
        // See https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
        recognition.lang = 'cmn';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.start();
        recognition.onresult = e => {
            let last = e.results.length - 1;
            let transcript = e.results[last][0].transcript;
            switch (transcript) {
                case '播放':
                    if (this.video.paused) this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-btn').click();
                    this.hintInfo(`BiliPolyfill: 语音:播放`);
                    break;
                case '暂停':
                    if (!this.video.paused) this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-btn').click();
                    this.hintInfo(`BiliPolyfill: 语音:暂停`);
                    break;
                case '全屏':
                    this.playerWin.document.querySelector('#bilibiliPlayer div.bilibili-player-video-btn-fullscreen').click();
                    this.hintInfo(`BiliPolyfill: 语音:全屏`);
                    break;
                case '关闭':
                    top.window.close();
                    break;
                case '加速':
                    this.setVideoSpeed(2);
                    this.hintInfo(`BiliPolyfill: 语音:加速`);
                    break;
                case '减速':
                    this.setVideoSpeed(0.5);
                    this.hintInfo(`BiliPolyfill: 语音:减速`);
                    break;
                case '下一集':
                    this.video.dispatchEvent(new Event('ended'));
                default:
                    this.hintInfo(`BiliPolyfill: 语音:"${transcript}"？`);
                    break;
            }
            console.log(e.results);
            console.log(`transcript:${transcript} confidence:${e.results[0][0].confidence}`);
        };
    }

    async getPlayerVideo() {
        if (this.playerWin.document.getElementsByTagName('video').length) {
            return this.video = this.playerWin.document.getElementsByTagName('video')[0];
        }
        else if (MutationObserver) {
            return new Promise(resolve => {
                let observer = new MutationObserver(() => {
                    if (this.playerWin.document.getElementsByTagName('video').length) {
                        observer.disconnect();
                        resolve(this.video = this.playerWin.document.getElementsByTagName('video')[0]);
                    }
                });
                observer.observe(this.playerWin.document.getElementById('bilibiliPlayer'), { childList: true });
            });
        }
        else {
            return new Promise(resolve => {
                let t = setInterval(() => {
                    if (this.playerWin.document.getElementsByTagName('video').length) {
                        clearInterval(t);
                        resolve(this.video = this.playerWin.document.getElementsByTagName('video')[0]);
                    }
                }, 600);
            });
        }
    }

    static parseHref(href = top.location.href) {
        if (href.indexOf('bangumi') != -1) {
            let anime, play;
            anime = (anime = /anime\/\d+/.exec(href)) ? anime[0].slice(6) : null;
            play = (play = /play#\d+/.exec(href)) ? play[0].slice(5) : null;
            if (!anime || !play) return null;
            return `bangumi.bilibili.com/anime/${anime}/play#${play}`;
        }
        else {
            let aid, pid;
            aid = (aid = /av\d+/.exec(href)) ? aid[0].slice(2) : null;
            if (!aid) return null;
            pid = (pid = /page=\d+/.exec(href)) ? pid[0].slice(5) : (pid = /index_\d+.html/.exec(href)) ? pid[0].slice(6, -5) : null;
            if (!pid) return `www.bilibili.com/video/av${aid}`;
            return `www.bilibili.com/video/av${aid}/index_${pid}.html`;
        }
    }

    static secondToReadable(s) {
        if (s > 60) return `${parseInt(s / 60)}分${parseInt(s % 60)}秒`;
        else return `${parseInt(s % 60)}秒`;
    }

    static clearAllUserdata(playerWin = top) {
        if (playerWin.GM_setValue) return GM_setValue('biliPolyfill', '');
        playerWin.localStorage.removeItem('biliPolyfill');
    }

    static _UNIT_TEST() {
        console.warn('This test is impossible.');
        console.warn('You need to close the tab, reopen it, etc.');
        console.warn('Maybe you also want to test between bideo parts, etc.');
        console.warn('I am too lazy to find workarounds.');
    }
}

class BiliUserJS {
    static async getIframeWin() {
        if (document.querySelector('#bofqi > iframe').contentDocument.getElementById('bilibiliPlayer')) {
            return document.querySelector('#bofqi > iframe').contentWindow;
        }
        else {
            return new Promise(resolve => {
                document.querySelector('#bofqi > iframe').addEventListener('load', () => {
                    resolve(document.querySelector('#bofqi > iframe').contentWindow);
                });
            });
        }
    }

    static async getPlayerWin() {
        if (location.host == 'bangumi.bilibili.com') {
            if (document.querySelector('#bofqi > iframe')) {
                return BiliUserJS.getIframeWin();
            }
            else if (MutationObserver) {
                return new Promise(resolve => {
                    let observer = new MutationObserver(() => {
                        if (document.querySelector('#bofqi > iframe')) {
                            observer.disconnect();
                            resolve(BiliUserJS.getIframeWin());
                        }
                        else if (document.querySelector('#bofqi > object')) {
                            observer.disconnect();
                            throw 'Need H5 Player';
                        }
                    });
                    observer.observe(window.document.getElementById('bofqi'), { childList: true });
                });
            }
            else {
                return new Promise(resolve => {
                    let t = setInterval(() => {
                        if (document.querySelector('#bofqi > iframe')) {
                            clearInterval(t);
                            resolve(BiliUserJS.getIframeWin());
                        }
                        else if (document.querySelector('#bofqi > object')) {
                            clearInterval(t);
                            throw 'Need H5 Player';
                        }
                    }, 600);
                });
            }
        }
        else {
            if (document.querySelector('#bofqi > object')) {
                throw 'Need H5 Player';
            }
            else {
                return window;
            }
        }
    }
}

class UI extends BiliUserJS {
    // Title Append
    static titleAppend(monkey) {
        let h = document.querySelector('div.viewbox div.info');
        let tminfo = document.querySelector('div.tminfo');
        let div = document.createElement('div');
        let flvA = document.createElement('a');
        let mp4A = document.createElement('a');
        let assA = document.createElement('a');
        flvA.textContent = '超清FLV';
        mp4A.textContent = '原生MP4';
        assA.textContent = '弹幕ASS';

        flvA.onmouseover = async () => {
            flvA.textContent = '正在FLV';
            flvA.onmouseover = null;
            await monkey.queryInfo('flv');
            flvA.textContent = '超清FLV';
            let flvDiv = UI.genFLVDiv(monkey);
            document.body.appendChild(flvDiv);
            flvA.onclick = () => flvDiv.style.display = 'block';
        };
        mp4A.onmouseover = async () => {
            mp4A.textContent = '正在MP4';
            mp4A.onmouseover = null;
            mp4A.href = await monkey.queryInfo('mp4');
            //mp4A.target = '_blank'; // You know pop up blocker? :)
            mp4A.textContent = '原生MP4';
            mp4A.download = '';
        };
        assA.onmouseover = async () => {
            assA.textContent = '正在ASS';
            assA.onmouseover = null;
            assA.href = await monkey.queryInfo('ass');
            assA.textContent = '弹幕ASS';
            if (monkey.mp4 && monkey.mp4.match) assA.download = monkey.mp4.match(/\d(\d|-|hd)*(?=\.mp4)/)[0] + '.ass';
            else assA.download = monkey.cid + '.ass';
        };

        flvA.style.fontSize = mp4A.style.fontSize = assA.style.fontSize = '16px';
        div.appendChild(flvA);
        div.appendChild(document.createTextNode(' '));
        div.appendChild(mp4A);
        div.appendChild(document.createTextNode(' '));
        div.appendChild(assA);
        div.className = 'info bilitwin';
        div.style.zIndex = '1';
        div.style.width = '32%';
        tminfo.style.float = 'left';
        tminfo.style.width = '68%';
        h.insertBefore(div, tminfo);
        return { flvA, mp4A, assA };
    }

    static genFLVDiv(monkey, flvs = monkey.flvs, cache = monkey.cache) {
        let div = UI.genDiv();

        let table = document.createElement('table');
        table.style.width = '100%';
        table.style.lineHeight = '2em';
        for (let i = 0; i < flvs.length; i++) {
            let tr = table.insertRow(-1);
            tr.insertCell(0).innerHTML = `<a href="${flvs[i]}">FLV分段 ${i + 1}</a>`;
            tr.insertCell(1).innerHTML = '<a>缓存本段</a>';
            tr.insertCell(2).innerHTML = '<progress value="0" max="100">进度条</progress>';
            tr.children[1].children[0].onclick = () => {
                UI.downloadFLV(tr.children[1].children[0], monkey, i, tr.children[2].children[0]);
            }
        }
        let tr = table.insertRow(-1);
        tr.insertCell(0).innerHTML = `<span>复制链接地址无效</span>`;
        tr.insertCell(1).innerHTML = '<a>缓存全部+自动合并</a>';
        tr.insertCell(2).innerHTML = `<progress value="0" max="${flvs.length + 1}">进度条</progress>`;
        tr.children[1].children[0].onclick = () => {
            UI.downloadAllFLVs(tr.children[1].children[0], monkey, table);
        }
        table.insertRow(-1).innerHTML = '<td colspan="3">合并功能推荐配置：至少8G RAM。把自己下载的分段FLV拖动到这里，也可以合并哦~</td>';
        table.insertRow(-1).innerHTML = cache ? '<td colspan="3">下载的缓存分段会暂时停留在电脑里，过一段时间会自动消失。建议只开一个标签页。</td>' : '<td colspan="3">建议只开一个标签页。关掉标签页后，缓存就会被清理。别忘了另存为！</td>';
        UI.displayQuota(table.insertRow(-1));
        div.appendChild(table);

        div.ondragenter = div.ondragover = e => UI.allowDrag(e);
        div.ondrop = async e => {
            UI.allowDrag(e);
            let files = Array.from(e.dataTransfer.files);
            if (files.every(e => e.name.search(/\d+-\d+.flv/) != -1)) {
                files.sort((a, b) => a.name.match(/\d+-(\d+).flv/)[1] - b.name.match(/\d+-(\d+).flv/)[1]);
            }
            for (let file of files) {
                table.insertRow(-1).innerHTML = `<td colspan="3">${file.name}</td>`;
            }
            let outputName = files[0].name.match(/\d+-\d.flv/);
            if (outputName) outputName = outputName[0].replace(/-\d/, "");
            else outputName = 'merge_' + files[0].name;
            let url = await UI.mergeFLVFiles(files);
            table.insertRow(-1).innerHTML = `<td colspan="3"><a href="${url}" download="${outputName}">${outputName}</a></td>`;
        }

        let buttons = [];
        for (let i = 0; i < 3; i++) buttons.push(document.createElement('button'));
        buttons.forEach(btn => btn.style.padding = '0.5em');
        buttons.forEach(btn => btn.style.margin = '0.2em');
        buttons[0].textContent = '关闭';
        buttons[0].onclick = () => {
            div.style.display = 'none';
        }
        buttons[1].textContent = '清空这个视频的缓存';
        buttons[1].onclick = () => {
            monkey.cleanAllFLVsInCache();
        }
        buttons[2].textContent = '清空所有视频的缓存';
        buttons[2].onclick = () => {
            UI.clearCacheDB(cache);
        }
        buttons.forEach(btn => div.appendChild(btn));

        return div;
    }

    static async downloadAllFLVs(a, monkey, table) {
        if (table.rows[0].cells.length < 3) return;
        monkey.hangPlayer();
        table.insertRow(-1).innerHTML = '<td colspan="3">已屏蔽网页播放器的网络链接。切换清晰度可重新激活播放器。</td>';

        for (let i = 0; i < monkey.flvs.length; i++) {
            if (table.rows[i].cells[1].children[0].textContent == '缓存本段')
                table.rows[i].cells[1].children[0].click();
        }

        let bar = a.parentNode.nextSibling.children[0];
        bar.max = monkey.flvs.length + 1;
        bar.value = 0;
        for (let i = 0; i < monkey.flvs.length; i++) monkey.getFLV(i).then(e => bar.value++);

        let blobs;
        blobs = await monkey.getAllFLVs();
        let mergedFLV = await FLV.mergeBlobs(blobs);
        let url = URL.createObjectURL(mergedFLV);
        let outputName = document.getElementsByClassName('v-title')[0].textContent;

        bar.value++;
        table.insertRow(0).innerHTML = `
        <td colspan="3" style="border: 1px solid black">
            <a href="${url}" download="${outputName}.flv">保存合并后FLV</a> 
            <a href="${await monkey.ass}" download="${outputName}.ass">弹幕ASS</a> 
            记得清理分段缓存哦~
        </td>
        `;
        return url;
    }

    static async downloadFLV(a, monkey, index, bar = {}) {
        let handler = e => UI.beforeUnloadHandler(e);
        window.addEventListener('beforeunload', handler);

        a.textContent = '取消';
        a.onclick = () => {
            a.onclick = null;
            window.removeEventListener('beforeunload', handler);
            a.textContent = '已取消';
            monkey.abortFLV(index);
        };

        let url;
        try {
            url = await monkey.getFLV(index, (loaded, total) => {
                bar.value = loaded;
                bar.max = total;
            });
            url = URL.createObjectURL(url);
            if (bar.value == 0) bar.value = bar.max = 1;
        } catch (e) {
            a.onclick = null;
            window.removeEventListener('beforeunload', handler);
            a.textContent = '错误';
            throw e;
        }

        a.onclick = null;
        window.removeEventListener('beforeunload', handler);
        a.textContent = '另存为';
        a.download = monkey.flvs[index].match(/\d+-\d+.flv/)[0];
        a.href = url;
        return url;
    }

    static async mergeFLVFiles(files) {
        let merged = await FLV.mergeBlobs(files)
        return URL.createObjectURL(merged);
    }

    static async clearCacheDB(cache) {
        if (cache) return cache.deleteEntireDB();
    }

    static async displayQuota(tr) {
        return new Promise(resolve => {
            let temporaryStorage = window.navigator.temporaryStorage
                || window.navigator.webkitTemporaryStorage
                || window.navigator.mozTemporaryStorage
                || window.navigator.msTemporaryStorage;
            if (!temporaryStorage) return resolve(tr.innerHTML = `<td colspan="3">这个浏览器不支持缓存呢~关掉标签页后，缓存马上就会消失哦</td>`);
            temporaryStorage.queryUsageAndQuota((usage, quota) =>
                resolve(tr.innerHTML = `<td colspan="3">缓存已用空间：${Math.round(usage / 1048576)}MB / ${Math.round(quota / 1048576)}MB 也包括了B站本来的缓存</td>`)
            );
        });
    }

    // Menu Append
    static menuAppend(playerWin, { monkey, monkeyTitle, polyfill, displayPolyfillDataDiv, optionDiv }) {
        let monkeyMenu = UI.genMonkeyMenu(playerWin, { monkey, monkeyTitle, optionDiv });
        let polyfillMenu = UI.genPolyfillMenu(playerWin, { polyfill, displayPolyfillDataDiv, optionDiv });
        let ul = playerWin.document.getElementsByClassName('bilibili-player-context-menu-container black')[0].children[0];
        ul.appendChild(monkeyMenu);
        ul.appendChild(polyfillMenu);

        let observer = new MutationObserver(record => {
            if (ul.children.length > 2 && ul.children[ul.children.length - 2] == monkeyMenu && ul.children[ul.children.length - 1] == polyfillMenu) {
                ul.insertBefore(polyfillMenu, ul.firstChild);
                ul.insertBefore(monkeyMenu, ul.firstChild);
            }
            if (ul.children.length == 0) {
                observer.disconnect();
            }
        });
        observer.observe(playerWin.document.getElementsByClassName('bilibili-player-context-menu-container black')[0], { attributes: true });
    }

    static genMonkeyMenu(playerWin, { monkey, monkeyTitle, optionDiv }) {
        let li = playerWin.document.createElement('li');
        li.className = 'context-menu-menu bilitwin';
        li.innerHTML = `
            <a class="context-menu-a">
                BiliMonkey
                <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
            </a>
            <ul>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 下载FLV
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 下载MP4
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 下载ASS
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 设置/帮助/关于
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)载入缓存FLV
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)强制刷新
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)重启脚本
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)销毁播放器
                    </a>
                </li>
            </ul>
            `;
        li.onclick = () => playerWin.document.getElementsByClassName('bilibili-player-watching-number')[0].click();
        let ul = li.children[1];
        ul.children[0].onclick = async () => { if (monkeyTitle.flvA.onmouseover) await monkeyTitle.flvA.onmouseover(); monkeyTitle.flvA.click(); };
        ul.children[1].onclick = async () => { if (monkeyTitle.mp4A.onmouseover) await monkeyTitle.mp4A.onmouseover(); monkeyTitle.mp4A.click(); };
        ul.children[2].onclick = async () => { if (monkeyTitle.assA.onmouseover) await monkeyTitle.assA.onmouseover(); monkeyTitle.assA.click(); };
        ul.children[3].onclick = () => { optionDiv.style.display = 'block'; };
        ul.children[4].onclick = async () => {
            monkey.proxy = true;
            monkey.flvs = null;
            UI.hintInfo('请稍候，可能需要10秒时间……', playerWin);
            // Yes, I AM lazy.
            playerWin.document.querySelector('div.bilibili-player-video-btn-quality > div > ul > li:nth-child(1)').click();
            await new Promise(r => playerWin.document.getElementsByTagName('video')[0].addEventListener('emptied', r));
            return monkey.queryInfo('flv');
        };
        ul.children[5].onclick = () => { top.location.reload(true); };
        ul.children[6].onclick = () => { setTimeout(UI.reInit, 0); };
        ul.children[7].onclick = () => { playerWin.player ? playerWin.player.destroy() : undefined; };
        return li;
    }

    static genPolyfillMenu(playerWin, { polyfill, displayPolyfillDataDiv, optionDiv }) {
        let li = playerWin.document.createElement('li');
        li.className = 'context-menu-menu bilitwin';
        li.innerHTML = `
            <a class="context-menu-a">
                BiliPolyfill
                <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
            </a>
            <ul>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 切片:<span></span>
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 获取封面
                    </a>
                </li>
                <li class="context-menu-menu">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 更多播放速度
                        <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
                    </a>
                    <ul>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 0.1
                            </a>
                        </li>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 3
                            </a>
                        </li>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 点击确认
                                <input type="text" style="width: 35px; height: 70%">
                            </a>
                        </li>
                    </ul>
                </li>
                <li class="context-menu-menu">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 片头片尾
                        <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
                    </a>
                    <ul>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 标记片头:<span></span>
                            </a>
                        </li>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 标记片尾:<span></span>
                            </a>
                        </li>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 取消标记
                            </a>
                        </li>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> 检视数据
                            </a>
                        </li>
                    </ul>
                </li>
                <li class="context-menu-menu">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 找上下集
                        <span class="bpui-icon bpui-icon-arrow-down" style="transform:rotate(-90deg);margin-top:3px;"></span>
                    </a>
                    <ul>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> <span></span>
                            </a>
                        </li>
                        <li class="context-menu-function">
                            <a class="context-menu-a">
                                <span class="video-contextmenu-icon"></span> <span></span>
                            </a>
                        </li>
                    </ul>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> 设置/帮助/关于
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)立即保存数据
                    </a>
                </li>
                <li class="context-menu-function">
                    <a class="context-menu-a">
                        <span class="video-contextmenu-icon"></span> (测)强制清空数据
                    </a>
                </li>
            </ul>
            `;
        li.onclick = () => playerWin.document.getElementsByClassName('bilibili-player-watching-number')[0].click();
        let ul = li.children[1];
        ul.children[0].onclick = () => { polyfill.video.dispatchEvent(new Event('ended')); };
        ul.children[1].onclick = () => { top.window.open(polyfill.getCoverImage(), '_blank'); };

        ul.children[2].children[1].children[0].onclick = () => { polyfill.setVideoSpeed(0.1); };
        ul.children[2].children[1].children[1].onclick = () => { polyfill.setVideoSpeed(3); };
        ul.children[2].children[1].children[2].onclick = () => { polyfill.setVideoSpeed(ul.children[2].children[1].children[2].getElementsByTagName('input')[0].value); };
        ul.children[2].children[1].children[2].getElementsByTagName('input')[0].onclick = e => e.stopPropagation();

        ul.children[3].children[1].children[0].onclick = () => { polyfill.markOPPosition(); };
        ul.children[3].children[1].children[1].onclick = () => { polyfill.markEDPostion(3); };
        ul.children[3].children[1].children[2].onclick = () => { polyfill.clearOPEDPosition(); };
        ul.children[3].children[1].children[3].onclick = () => { displayPolyfillDataDiv(polyfill); };

        ul.children[4].children[1].children[0].getElementsByTagName('a')[0].style.width = 'initial';
        ul.children[4].children[1].children[1].getElementsByTagName('a')[0].style.width = 'initial';

        ul.children[5].onclick = () => { optionDiv.style.display = 'block'; };
        ul.children[6].onclick = () => { polyfill.saveUserdata() };
        ul.children[7].onclick = () => {
            BiliPolyfill.clearAllUserdata(playerWin);
            polyfill.retriveUserdata();
        };

        li.onmouseenter = () => {
            let ul = li.children[1];
            ul.children[0].children[0].getElementsByTagName('span')[1].textContent = polyfill.autoNextDestination;

            ul.children[2].children[1].children[2].getElementsByTagName('input')[0].value = polyfill.video.playbackRate;

            ul.children[4].children[1].children[0].onclick = () => { if (polyfill.series[0]) top.window.open(`https://www.bilibili.com/video/av${polyfill.series[0].aid}`, '_blank'); };
            ul.children[4].children[1].children[1].onclick = () => { if (polyfill.series[1]) top.window.open(`https://www.bilibili.com/video/av${polyfill.series[1].aid}`, '_blank'); };
            ul.children[4].children[1].children[0].getElementsByTagName('span')[1].textContent = polyfill.series[0] ? polyfill.series[0].title : '找不到';
            ul.children[4].children[1].children[1].getElementsByTagName('span')[1].textContent = polyfill.series[1] ? polyfill.series[1].title : '找不到';

            let oped = polyfill.userdata.oped[polyfill.getCollectionId()] || [];
            ul.children[3].children[1].children[0].getElementsByTagName('span')[1].textContent = oped[0] ? BiliPolyfill.secondToReadable(oped[0]) : '无';
            ul.children[3].children[1].children[1].getElementsByTagName('span')[1].textContent = oped[1] ? BiliPolyfill.secondToReadable(oped[1]) : '无';
        }
        return li;
    }

    static genOptionDiv(option) {
        let div = UI.genDiv();

        div.appendChild(UI.genMonkeyOptionTable(option));
        div.appendChild(UI.genPolyfillOptionTable(option));
        let table = document.createElement('table');
        table.style = 'width: 100%; line-height: 2em;';
        table.insertRow(-1).innerHTML = '<td>设置自动保存，刷新后生效。</td>';
        table.insertRow(-1).innerHTML = '<td>视频下载组件的缓存功能只在Windows+Chrome测试过，如果出现问题，请关闭缓存。</td>';
        table.insertRow(-1).innerHTML = '<td>功能增强组件尽量保证了兼容性。但如果有同功能脚本/插件，请关闭本插件的对应功能。</td>';
        table.insertRow(-1).innerHTML = '<td>这个脚本乃“按原样”提供，不附带任何明示，暗示或法定的保证，包括但不限于其没有缺陷，适合特定目的或非侵权。</td>';
        table.insertRow(-1).innerHTML = '<td><a href="https://greasyfork.org/zh-CN/scripts/27819" target="_blank">更新/讨论</a> <a href="https://github.com/liqi0816/bilitwin/" target="_blank">GitHub</a> Author: qli5. Copyright: qli5, 2014+, 田生, grepmusic</td>';
        div.appendChild(table);

        let buttons = [];
        for (let i = 0; i < 3; i++) buttons.push(document.createElement('button'));
        buttons.map(btn => btn.style.padding = '0.5em');
        buttons.map(btn => btn.style.margin = '0.2em');
        buttons[0].textContent = '保存并关闭';
        buttons[0].onclick = () => {
            div.style.display = 'none';;
        }
        buttons[1].textContent = '保存并刷新';
        buttons[1].onclick = () => {
            top.location.reload();
        }
        buttons[2].textContent = '重置并刷新';
        buttons[2].onclick = () => {
            UI.saveOption({ setStorage: option.setStorage });
            top.location.reload();
        }
        buttons.map(btn => div.appendChild(btn));

        return div;
    }

    static genMonkeyOptionTable(option = {}) {
        const description = [
            ['autoDefault', '尝试自动抓取：不会拖慢页面，抓取默认清晰度，但可能抓不到。'],
            ['autoFLV', '强制自动抓取FLV：会拖慢页面，如果默认清晰度也是超清会更慢，但保证抓到。'],
            ['autoMP4', '强制自动抓取MP4：会拖慢页面，如果默认清晰度也是高清会更慢，但保证抓到。'],
            ['cache', '关标签页不清缓存：保留完全下载好的分段到缓存，忘记另存为也没关系。'],
            ['partial', '断点续传：点击“取消”保留部分下载的分段到缓存，忘记点击会弹窗确认。'],
            ['proxy', '用缓存加速播放器：如果缓存里有完全下载好的分段，直接喂给网页播放器，不重新访问网络。小水管利器，播放只需500k流量。如果实在搞不清怎么播放ASS弹幕，也可以就这样用。'],
            ['blocker', '弹幕过滤：在网页播放器里设置的屏蔽词也对下载的弹幕生效。'],
        ];

        let table = document.createElement('table');
        table.style.width = '100%';
        table.style.lineHeight = '2em';

        table.insertRow(-1).innerHTML = '<td style="text-align:center">BiliMonkey（视频抓取组件）</td>';
        table.insertRow(-1).innerHTML = '<td style="text-align:center">因为作者偷懒了，缓存的三个选项最好要么全开，要么全关。最好。</td>';
        for (let d of description) {
            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = option[d[0]];
            checkbox.onchange = () => { option[d[0]] = checkbox.checked; UI.saveOption(option); };
            let td = table.insertRow(-1).insertCell(0);
            td.appendChild(checkbox);
            td.appendChild(document.createTextNode(d[1]));
        }

        return table;
    }

    static genPolyfillOptionTable(option = {}) {
        const description = [
            ['betabeta', '增强组件总开关 <---------更加懒得测试了，反正以后B站也会自己提供这些功能。也许吧。'], //betabeta
            ['dblclick', '双击全屏'],
            ['scroll', '自动滚动到播放器'],
            ['recommend', '弹幕列表换成相关视频'],
            ['autoNext', '2秒换P'],
            //['autoNextTimeout', '快速换P等待时间(毫秒)'],
            ['lift', '自动防挡字幕'],
            ['autoResume', '自动跳转上次看到'],
            ['autoPlay', '自动播放'],
            ['autoFullScreen', '自动全屏'],
            ['oped', '标记后自动跳OP/ED'],
            ['speech', '(测)(需墙外)任意三击鼠标左键开启语音识别'],
            ['series', '(测)尝试自动找上下集'],
        ];

        let table = document.createElement('table');
        table.style.width = '100%';
        table.style.lineHeight = '2em';

        table.insertRow(-1).innerHTML = '<td style="text-align:center">BiliPolyfill（功能增强组件）</td>';
        table.insertRow(-1).innerHTML = '<td style="text-align:center">懒鬼作者还在测试的时候，B站已经上线了原生的稍后再看(๑•̀ㅂ•́)و✧</td>';
        for (let d of description) {
            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = option[d[0]];
            checkbox.onchange = () => { option[d[0]] = checkbox.checked; UI.saveOption(option); };
            let td = table.insertRow(-1).insertCell(0);
            td.appendChild(checkbox);
            td.appendChild(document.createTextNode(d[1]));
        }

        return table;
    }

    static displayPolyfillDataDiv(polyfill) {
        let div = UI.genDiv();
        let p = document.createElement('p');
        p.textContent = '这里是脚本储存的数据。所有数据都只存在浏览器里，别人不知道，B站也不知道，脚本作者更不知道(这个家伙连服务器都租不起 摔';
        p.style.margin = '0.3em';
        div.appendChild(p);

        let textareas = [];
        for (let i = 0; i < 2; i++) textareas.push(document.createElement('textarea'));
        textareas.forEach(ta => ta.style = 'resize:vertical; width: 100%; height: 200px');

        p = document.createElement('p');
        p.textContent = 'B站已上线原生的稍后观看功能。';
        p.style.margin = '0.3em';
        div.appendChild(p);
        //textareas[0].textContent = JSON.stringify(polyfill.userdata.watchLater).replace(/\[/, '[\n').replace(/\]/, '\n]').replace(/,/g, ',\n');
        //div.appendChild(textareas[0]);

        p = document.createElement('p');
        p.textContent = '这里是片头片尾。格式是，av号或番剧号:[片头,片尾]。null代表没有片头。';
        p.style.margin = '0.3em';
        div.appendChild(p);
        textareas[1].textContent = JSON.stringify(polyfill.userdata.oped).replace(/{/, '{\n').replace(/}/, '\n}').replace(/],/g, '],\n');
        div.appendChild(textareas[1]);

        p = document.createElement('p');
        p.textContent = '当然可以直接清空啦。只删除其中的一些行的话，一定要记得删掉多余的逗号。';
        p.style.margin = '0.3em';
        div.appendChild(p);

        let buttons = [];
        for (let i = 0; i < 3; i++) buttons.push(document.createElement('button'));
        buttons.forEach(btn => btn.style.padding = '0.5em');
        buttons.forEach(btn => btn.style.margin = '0.2em');
        buttons[0].textContent = '关闭';
        buttons[0].onclick = () => {
            div.remove();
        }
        buttons[1].textContent = '验证格式';
        buttons[1].onclick = () => {
            if (!textareas[0].value) textareas[0].value = '{\n\n}';
            textareas[0].value = textareas[0].value.replace(/,(\s|\n)*}/, '\n}').replace(/,(\s|\n),/g, ',\n');
            if (!textareas[1].value) textareas[1].value = '{\n\n}';
            textareas[1].value = textareas[1].value.replace(/,(\s|\n)*}/, '\n}').replace(/,(\s|\n),/g, ',\n').replace(/,(\s|\n)*]/g, ']');
            let userdata = {};
            try {
                //userdata.watchLater = JSON.parse(textareas[0].value);
            } catch (e) { alert('稍后观看列表: ' + e); throw e; }
            try {
                userdata.oped = JSON.parse(textareas[1].value);
            } catch (e) { alert('片头片尾: ' + e); throw e; }
            buttons[1].textContent = ('格式没有问题！');
            return userdata;
        }
        buttons[2].textContent = '尝试保存';
        buttons[2].onclick = () => {
            polyfill.userdata = buttons[1].onclick();
            polyfill.saveUserdata();
            buttons[2].textContent = ('保存成功');
        }
        buttons.forEach(btn => div.appendChild(btn));

        document.body.appendChild(div);
        div.style.display = 'block';
    }

    // Common
    static genDiv() {
        let div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.zIndex = '10036';
        div.style.top = '50%';
        div.style.marginTop = '-200px';
        div.style.left = '50%';
        div.style.marginLeft = '-320px';
        div.style.width = '540px';
        div.style.maxHeight = '400px';
        div.style.overflowY = 'auto';
        div.style.padding = '30px 50px';
        div.style.backgroundColor = 'white';
        div.style.borderRadius = '6px';
        div.style.boxShadow = 'rgba(0, 0, 0, 0.6) 1px 1px 40px 0px';
        div.style.display = 'none';
        div.className = 'bilitwin';
        return div;
    }

    static requestH5Player() {
        let h = document.querySelector('div.tminfo');
        h.insertBefore(document.createTextNode('[[脚本需要HTML5播放器(弹幕列表右上角三个点的按钮切换)]] '), h.firstChild);
    }

    static copyToClipboard(text) {
        let textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.value = text;
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    static allowDrag(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    static beforeUnloadHandler(e) {
        return e.returnValue = '脚本还没做完工作，真的要退出吗？';
    }

    static hintInfo(text, playerWin) {
        let infoDiv = playerWin.document.createElement('div');
        infoDiv.className = 'bilibili-player-video-toast-bottom';
        infoDiv.innerHTML = `
        <div class="bilibili-player-video-toast-item">
            <div class="bilibili-player-video-toast-item-text">
                <span>${text}</span>
            </div>
        </div>
        `;
        playerWin.document.getElementsByClassName('bilibili-player-video-toast-wrp')[0].appendChild(infoDiv);
        setTimeout(() => infoDiv.remove(), 3000);
    }

    static getOption(playerWin) {
        let rawOption = null;
        try {
            if (window.GM_getValue) {
                rawOption = JSON.parse(GM_getValue('BiliTwin'));
            }
            else {
                rawOption = JSON.parse(playerWin.localStorage.getItem('BiliTwin'));
            }
        }
        catch (e) { }
        finally {
            if (!rawOption) rawOption = {};
            if (window.GM_setValue) {
                rawOption.setStorage = (n, i) => GM_setValue(n, i);
                rawOption.getStorage = n => GM_getValue(n);
            }
            else {
                rawOption.setStorage = (n, i) => playerWin.localStorage.setItem(n, i);
                rawOption.getStorage = n => playerWin.localStorage.getItem(n);
            }
            const defaultOption = {
                autoDefault: true,
                autoFLV: false,
                autoMP4: false,
                cache: true,
                partial: true,
                proxy: true,
                blocker: true,
                dblclick: true,
                scroll: true,
                recommend: true,
                autoNext: true,
                autoNextTimeout: 2000,
                lift: true,
                autoResume: true,
                autoPlay: false,
                autoFullScreen: false,
                oped: true,
                speech: false,
                series: true,
                betabeta: false
            };
            return Object.assign({}, defaultOption, rawOption, debugOption);
        }
    }

    static saveOption(option) {
        return option.setStorage('BiliTwin', JSON.stringify(option));
    }

    static outdatedEngineClearance() {
        if (!Promise) {
            alert('这个浏览器实在太老了，脚本决定罢工。');
            throw 'BiliTwin: browser outdated: Promise unsupported';
        }
    }

    static firefoxClearance() {
        if (navigator.userAgent.indexOf('Firefox') != -1) {
            if (!document.getElementsByTagName('div').length) throw 'BiliTwin: Fire In the Fox ERROR: Script received an empty document';
            if (GM_info && GM_info.scriptHandler != 'Tampermonkey') {
                let div = UI.genDiv();
                div.innerHTML = `
                <p>您在使用GreasyMonkey吗？</p>
                <p>不知道为什么——GreasyMonkey不支持BiliTwin脚本。</p>
                <p>您可以
                    <ol>
                        <li>1. 用<a href="https://addons.mozilla.org/firefox/addon/tampermonkey">TamperMonkey</a>安装脚本。别担心，它和GreasyMonkey可以共存。</li>
                        <li>2. 把这个书签小程序<a href="javascript:(function(){f=document.createElement('script');f.setAttribute('src','https://liqi0816.github.io/bilitwin/biliTwin.user.js');document.body.appendChild(f)})()">Twin</a>拖动到书签栏。连安装都不需要，点一下就能运行脚本。</li>
                        <li>3. 到<a href="https://greasyfork.org/zh-CN/scripts/27819">GreasyFork</a>上讨论这个问题。</li>
                        <li>4. <a href="https://github.com/liqi0816/bilitwin/">Fork You!</a></li>
                        <li>5. <a onclick="this.parentElement.parentElement.parentElement.remove()">先试试看。</a></li>
                    <ol>
                </p>
                `;
                div.style.lineHeight = '2em';
                div.style.display = '';
                unsafeWindow.document.body.appendChild(div);
            }
            debugOption.proxy = false;
            if (!window.navigator.temporaryStorage && !window.navigator.mozTemporaryStorage) window.navigator.temporaryStorage = { queryUsageAndQuota: func => func(-1048576, 10484711424) };
            if (top.unsafeWindow) Object.defineProperty(top.unsafeWindow, 'biliTwinInstanceCount', { value: new Number(1) });
        }
    }

    static xpcWrapperClearance() {
        if (top.unsafeWindow) {
            Object.defineProperty(window, 'cid', {
                configurable: true,
                get: () => String(unsafeWindow.cid)
            });
            Object.defineProperty(window, 'pageno', {
                configurable: true,
                get: () => String(unsafeWindow.pageno)
            });
            Object.defineProperty(window, 'player', {
                configurable: true,
                get: () => { return { next: unsafeWindow.player.next, destroy: unsafeWindow.player.destroy, reloadAccess: unsafeWindow.player.reloadAccess } }
            });
            Object.defineProperty(window, 'fetch', {
                configurable: true,
                get: () => unsafeWindow.fetch.bind(unsafeWindow),
                set: _fetch => unsafeWindow.fetch = _fetch.bind(unsafeWindow)
            });
            /*
            Object.defineProperty(window, '$', {
                configurable: true,
                get: () => unsafeWindow['$']
            });*/
        }
    }

    static cleanUI() {
        Array.from(document.getElementsByClassName('bilitwin'))
            .filter(e => e.textContent.indexOf('FLV分段') != -1)
            .forEach(e => Array.from(e.getElementsByTagName('a')).forEach(
                e => e.textContent == '取消' ? e.click() : undefined
            ));
        Array.from(document.getElementsByClassName('bilitwin')).forEach(e => e.remove());
    }

    static reInit() {
        document.querySelector('#bofqi > iframe') ? document.querySelector('#bofqi > iframe').remove() : undefined;
        UI.cleanUI();
        UI.init();
    }

    static async init() {
        UI.outdatedEngineClearance();
        UI.xpcWrapperClearance();
        UI.firefoxClearance();

        let playerWin;
        try {
            playerWin = await UI.getPlayerWin();
            if (top.location.hostname == 'bangumi.bilibili.com') playerWin.addEventListener('unload', () => UI.reInit());
            else playerWin.addEventListener('hashchange', () => UI.reInit());
        } catch (e) {
            if (e == 'Need H5 Player') UI.requestH5Player();
            throw e;
        }
        let option = UI.getOption(playerWin);
        let optionDiv = UI.genOptionDiv(option);//sideAppend(option);
        document.body.appendChild(optionDiv);

        let monkeyTitle;
        let displayPolyfillDataDiv = polyfill => UI.displayPolyfillDataDiv(polyfill);
        let [monkey, polyfill] = await Promise.all([
            (async () => {
                let monkey = new BiliMonkey(playerWin, option);
                await monkey.execOptions();
                monkeyTitle = UI.titleAppend(monkey);
                return monkey;
            })(),
            (async () => {
                let polyfill = new BiliPolyfill(playerWin, option, t => UI.hintInfo(t, playerWin));
                await polyfill.setFunctions();
                //UI.sidePolyfillAppend(polyfill);
                return polyfill;
            })()
        ]);

        UI.menuAppend(playerWin, { monkey, monkeyTitle, polyfill, displayPolyfillDataDiv, optionDiv });

        if (debugOption.debug && top.console) top.console.clear();
        if (debugOption.debug) ([(top.unsafeWindow || top).m, (top.unsafeWindow || top).p] = [monkey, polyfill]);
        return [monkey, polyfill];
    }
}

UI.init();