import WebAudioModule from "https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/freeverbForBrowser/utils/sdk/src/WebAudioModule.js";
import ParamMgrFactory from "https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/freeverbForBrowser/utils/sdk-parammgr/src/ParamMgrFactory.js";
import PedalBoardNode from "./Wam/node.js";
import { createElement } from "./Gui/index.js";

/**
 * @param {URL} relativeURL
 * @returns {string}
 */
const getBasetUrl = (relativeURL) => {
  const baseURL = relativeURL.href.substring(
    0,
    relativeURL.href.lastIndexOf("/")
  );
  return baseURL;
};

export default class PedalBoardPlugin extends WebAudioModule {
  _baseURL = getBasetUrl(new URL(".", import.meta.url));

  _descriptorUrl = `${this._baseURL}/descriptor.json`;

  id = 0;

  async _loadDescriptor() {
    const url = this._descriptorUrl;
    if (!url) throw new TypeError("Descriptor not found");
    const response = await fetch(url);
    const descriptor = await response.json();
    Object.assign(this.descriptor, descriptor);
  }

  async initialize(state) {
    await this._loadDescriptor();
    await this.fetchPedals();
    return super.initialize(state);
  }

  async createAudioNode(initialState) {
    this.pedalboardNode = new PedalBoardNode(this.audioContext);
    const internalParamsConfig = {};

    const optionsIn = { internalParamsConfig };
    const paramMgrNode = await ParamMgrFactory.create(this, optionsIn);
    this.pedalboardNode.setup(paramMgrNode);
    if (initialState) this.pedalboardNode.setState(initialState);
    return this.pedalboardNode;
  }

  async fetchPedals() {
    let file = await fetch("../pedalboard/pedals.json");
    let json = await file.json();

    let responses = await Promise.all(
      json.map((el) => fetch(`${el}descriptor.json`))
    );

    let descriptors = await Promise.all(responses.map((el) => el.json()));
    let modules = await Promise.all(json.map((el) => import(`${el}index.js`)));

    this.pedals = {};
    descriptors.forEach((el, index) => {
      this.pedals[el.name] = {
        url: json[index],
        descriptor: el,
        module: modules[index],
      };
    });
  }

  addPedal(pedalName) {
    const { default: WAM } = this.pedals[pedalName].module;
    WAM.createInstance(
      this.pedalboardNode.module._groupId,
      this.pedalboardNode.context
    ).then((instance) => {
      this.pedalboardNode.addPlugin(instance.audioNode, this.id);
      this.gui.addPlugin(instance, this.id);
      this.id++;
    });
  }

  createGui() {
    return createElement(this);
  }
}
