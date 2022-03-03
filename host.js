const player = document.querySelector("#soundSample");
const mount = document.querySelector("#mount");
const preview = document.querySelector("#preview");

// Safari...
const AudioContext =
  window.AudioContext || // Default
  window.webkitAudioContext || // Safari and old versions of Chrome
  false;

const audioContext = new AudioContext();
const mediaElementSource = audioContext.createMediaElementSource(player);

const plugins = {};

const connectPlugin = (audioNode) => {
  try {
    mediaElementSource.connect(audioNode);
  } catch (error) {
    mediaElementSource.connect(audioNode.getInput(0));
  }
  audioNode.connect(audioContext.destination);
};

const mountPlugin = (domNode) => {
  mount.appendChild(domNode);
};

function scriptExists(url) {
  return document.querySelectorAll(`script[src="${url}"]`).length > 0;
}

async function buildPlugin(className, baseURL) {
  var plugin = new window[className](audioContext, baseURL);

  var node = await plugin.load();
  var gui = await plugin.loadGui();

  plugins[baseURL] = { node, gui, on: false };
}

function addThumbnail(baseURL, metadata) {
  var img = document.createElement("img");
  img.src = baseURL + "/" + metadata.thumbnail;
  img.addEventListener(
    "click",
    () => {
      let plugin = plugins[baseURL];
      if (plugin && !plugin.on) {
        plugin.on = true;
        mountPlugin(plugin.gui);
        connectPlugin(plugin.node);
      }
    },
    { passive: false }
  );
  preview.appendChild(img);
}

function loadAllPlugins() {
  fetch("/plugins.json")
    .then((file) => file.json())
    .then((json) => {
      let urls = json.plugins.map((el) => json.baseUrl + "/" + el.path);
      Promise.all(urls.map((el) => fetch(el + "/main.json"))).then((res) => {
        Promise.all(res.map((el) => el.json())).then((jsons) => {
          jsons.forEach((metadata, index) => {
            const baseURL = urls[index];
            const className = metadata.vendor + metadata.name;
            const scriptURL = baseURL + "/main.js";

            if (scriptExists(scriptURL)) {
              buildPlugin(className, baseURL);
            } else {
              let script = document.createElement("script");
              script.src = scriptURL;
              document.head.appendChild(script);

              script.onload = () => buildPlugin(className, baseURL);
            }
            addThumbnail(baseURL, metadata);
          });
        });
      });
    });
}

window.onload = () => {
  var gainNode = audioContext.createGain();
  gainNode.gain = 1;
  connectPlugin(gainNode);

  loadAllPlugins();

  player.onplay = () => {
    audioContext.resume();
  };
};
