import WebAudioModule from "https://mainline.i3s.unice.fr/wam2/packages/sdk/src/WebAudioModule.js";
import ParamMgrFactory from "https://mainline.i3s.unice.fr/wam2/packages/sdk-parammgr/src/ParamMgrFactory.js";
import PedalBoardNode from "./Wam/node.js";
import { createElement } from "./Gui/index.js";

/**
 * @param {URL} relativeURL
 * @returns {string}
 */
const getBasetUrl = (relativeURL) => {
  const baseURL = relativeURL.href.substring(0, relativeURL.href.lastIndexOf("/"));
  return baseURL;
};

/**
 * If the URL is relative, it makes it absolute by replacing the dot by the baseUrl of the file.
 * @param {string} relativeURL
 * @returns The new URL if ut was a relative URL.
 * @author Quentin Beauchet
 */
const relativeToAbsoluteUrl = (relativeURL, baseURL) => {
  if (relativeURL[0] == ".") {
    return `${baseURL}${relativeURL.substring(1)}`;
  } else {
    return relativeURL;
  }
};

export default class PedalBoardPlugin extends WebAudioModule {
  _baseURL = getBasetUrl(new URL(".", import.meta.url));

  _descriptorUrl = `${this._baseURL}/descriptor.json`;

  _id = 0;

  WAMS = {};

  async _loadDescriptor() {
    const url = this._descriptorUrl;
    if (!url) throw new TypeError("Descriptor not found");
    const response = await fetch(url);
    const descriptor = await response.json();
    Object.assign(this.descriptor, descriptor);
  }

  async initialize(state) {
    await this._loadDescriptor();
    await this.fetchWAMs();
    return super.initialize(state);
  }

  /**
   * Initialize the WamNode of the PedalBoard with an initialState if provided.
   * @param {*} initialState
   * @returns The PedalBoardNode.
   * @author Quentin Beauchet
   */
  async createAudioNode(initialState) {
    this.pedalboardNode = new PedalBoardNode(this.audioContext);

    const paramMgrNode = await ParamMgrFactory.create(this, {});
    this.pedalboardNode.setup(paramMgrNode);
    if (initialState) this.pedalboardNode.setState(initialState);
    return this.pedalboardNode;
  }

  /**
   * Fetch the wams URL from each of the servers in the servers.json file and fetch their descriptor.json
   * and then import their WebAudioModule.
   * For each of them store the needed information in this.WAMS.
   * @author Quentin Beauchet
   */
  async fetchWAMs() {
    const filterFetch = (el) => el.status == "fulfilled" && el.value.status == 200;

    let servers = await fetch(`${this._baseURL}/servers.json`);
    let json = await servers.json();
    let files = await Promise.allSettled(json.map((el) => fetch(relativeToAbsoluteUrl(el, this._baseURL))));
    let urls = await Promise.all(files.filter(filterFetch).map((el) => el.value.json()));
    urls = urls.reduce((arr, next) => arr.concat(next), []);

    let responses = await Promise.allSettled(urls.map((el) => fetch(`${el}descriptor.json`)));

    let descriptors = await Promise.all(responses.filter(filterFetch).map((el) => el.value.json()));
    let modules = await Promise.allSettled(urls.map((el) => import(`${el}index.js`)));

    descriptors.forEach((el, index) => {
      if (modules[index].status == "fulfilled") {
        this.WAMS[el.name] = {
          url: urls[index],
          descriptor: el,
          module: modules[index].value,
        };
      }
    });
  }

  async loadState(state) {
    for (let el of state.nodes) {
      await this.addWAM(el.name, el.state);
    }
    this.pedalboardNode._output.gain.value = state.gain;
  }

  /**
   * Add the WAM to the board, instanciate the WamNode with an initial state if provided and append the Gui to the board.
   * @param {string} WAMName
   * @param {Object} state
   * @author Quentin Beauchet
   */
  async addWAM(WAMName, state) {
    const { default: WAM } = this.WAMS[WAMName].module;
    let instance = await WAM.createInstance(this.pedalboardNode.module._groupId, this.pedalboardNode.context);
    if (state) {
      instance.audioNode.setState(state);
    }
    this.pedalboardNode.addPlugin(instance.audioNode, WAMName, this._id);
    this.gui.addPlugin(instance, this.WAMS[WAMName].img, this._id);
    this._id++;
  }

  createGui() {
    return createElement(this);
  }
}
