const processor = (moduleId) => {
  const audioWorkletGlobalScope = globalThis;
  const { AudioWorkletProcessor, registerProcessor, webAudioModules } = audioWorkletGlobalScope;

  class WamEventDestinationProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      this.destroyed = false;
      const { instanceId, groupId } = options.processorOptions;
      this.groupId = groupId;
      this.moduleId = moduleId;
      this.instanceId = instanceId;
      webAudioModules.addWam(this);
      this.onScheduleEvents = (...events) => events;
      this.onEmitEvents = (...events) => events;
      this.onClearEvents = () => {};

      this._messagePortRequestId = -1;
      const resolves = {};
      const rejects = {};

      this.call = (call, ...args) =>
        new Promise((resolve, reject) => {
          const id = this._messagePortRequestId;
          this._messagePortRequestId -= 1;
          resolves[id] = resolve;
          rejects[id] = reject;
          this.port.postMessage({ id, call, args });
        });
      this.handleMessage = ({ data }) => {
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
          if (error) rejects[id]?.(error);
          else resolves[id]?.(value);
          delete resolves[id];
          delete rejects[id];
        }
      };
      this.port.start();
      this.port.addEventListener("message", this.handleMessage);
    }
    getCompensationDelay() {
      return 0;
    }

    scheduleEvents(...events) {
      if (this.destroyed) return;
      this.onScheduleEvents?.(...events);
    }

    emitEvents(...events) {
      if (this.destroyed) return;
      this.onEmitEvents?.(...events);
    }
    clearEvents() {
      if (this.destroyed) return;
      this.onClearEvents?.();
    }
    process() {
      return true;
    }
    destroy() {
      audioWorkletGlobalScope.webAudioModules.removeWam(this);
      this.destroyed = true;
      this.port.close();
    }
  }
  try {
    registerProcessor(moduleId, WamEventDestinationProcessor);
  } catch (error) {
    console.warn(error);
  }

  return WamEventDestinationProcessor;
};

export default processor;
