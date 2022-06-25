export default class WamEventDestinationNode extends AudioWorkletNode {
  constructor(module) {
    const { audioContext, moduleId, instanceId, groupId } = module;
    const options = {
      processorOptions: { moduleId, instanceId, groupId },
    };
    super(audioContext, moduleId, options);
    this.module = module;

    this._resolves = {};
    this._rejects = {};
    this._messageRequestId = 0;

    this._call = (call, ...args) => {
      const id = this._messageRequestId;
      this._messageRequestId += 1;
      return new Promise((resolve, reject) => {
        this._resolves[id] = resolve;
        this._rejects[id] = reject;
        this.port.postMessage({ id, call, args });
      });
    };
    this._handleMessage = ({ data }) => {
      const { id, call, args, value, error } = data;
      if (call) {
        const r = { id };
        try {
          r.value = this[call](...args);
        } catch (e) {
          r.error = e;
        }
        this.port.postMessage(r);
      } else {
        if (error) {
          if (this._rejects[id]) this._rejects[id](error);
          delete this._rejects[id];
          return;
        }
        if (this._resolves[id]) {
          this._resolves[id](value);
          delete this._resolves[id];
        }
      }
    };

    this.port.start();
    this.port.addEventListener("message", this._handleMessage);
  }
  get groupId() {
    return this.module.groupId;
  }

  get moduleId() {
    return this.module.moduleId;
  }

  get instanceId() {
    return this.module.instanceId;
  }

  async getParameterInfo(...parameterIds) {
    return {};
  }

  async getParameterValues(normalized, ...parameterIds) {
    return {};
  }

  async setParameterValues(parameterValues) {}

  async setState(state) {}

  async getState() {
    return undefined;
  }

  async getCompensationDelay() {
    return 0;
  }

  scheduleEvents(...events) {}

  clearEvents() {}

  connectEvents(toId, output) {}

  disconnectEvents(toId, output) {}

  async destroy() {
    this.disconnect();
    await this._call("destroy");
    this.port.close();
  }
}
