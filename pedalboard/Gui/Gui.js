/**
 * @param {URL} relativeURL
 * @returns {string}
 */
const getBasetUrl = (relativeURL) => {
  const baseURL = relativeURL.href.substring(0, relativeURL.href.lastIndexOf("/"));
  return baseURL;
};

export default class pedalboardGui extends HTMLElement {
  _baseURL = getBasetUrl(new URL(".", import.meta.url));

  _saveSVGUrl = `${this._baseURL}/assets/saveButton.svg`;
  _editSVGUrl = `${this._baseURL}/assets/editButton.svg`;
  _deleteSVGUrl = `${this._baseURL}/assets/deleteButton.svg`;
  _crossIMGUrl = `${this._baseURL}/assets/cross.png`;
  _notFoundIMGUrl = `${this._baseURL}/assets/notfound.jpg`;

  constructor(plug) {
    super();
    this._plug = plug;
    this._plug.gui = this;

    this._root = this.attachShadow({ mode: "open" });

    this.init();
  }

  // Initlialise the differents elements of the gui
  async init() {
    this.setStyle();
    this.body = document.createElement("body");

    this.preview = await this.loadThumbnails();
    this.createBoard();
    this._plug.pedalboardNode.setState(this._plug.pedalboardNode.initialState);

    this.body.appendChild(this.preview);
    this.body.appendChild(this.board);

    this._root.appendChild(this.body);
  }

  // Load the thumbnails of the plugins
  async loadThumbnails() {
    let wams = Object.keys(this._plug.WAMS);
    let keywords = { all: [] };
    let urls = await Promise.all(
      wams.map((el) => {
        let wam = this._plug.WAMS[el];
        keywords["all"].push(el);
        wam.descriptor.keywords.forEach((k) => {
          if (!(k in keywords)) {
            keywords[k] = [];
          }
          keywords[k].push(el);
        });
        let thumbnail = wam.descriptor.thumbnail;
        if (thumbnail == "") {
          return this._notFoundIMGUrl;
        }
        return `${wam.url}${thumbnail}`;
      })
    );

    let preview = document.createElement("div");
    preview.id = "preview";

    let select = document.createElement("select");
    const refreshImages = (select) => {
      let keys = Object.keys(keywords);
      let currentKey = keys[select.selectedIndex];
      this.images.innerHTML = "";
      keywords[currentKey].forEach((el) => {
        this.images.appendChild(this._plug.WAMS[el].img);
      });
    };
    select.addEventListener("change", (event) => refreshImages(event.target));

    for (let key of Object.keys(keywords)) {
      let filter = document.createElement("option");
      filter.innerHTML = key;
      select.appendChild(filter);
    }
    preview.appendChild(select);

    this.images = document.createElement("div");
    urls.forEach((el, index) => {
      let img = document.createElement("img");
      img.src = el;
      img.setAttribute("crossorigin", "anonymous");
      img.addEventListener("click", () => this._plug.addWAM(wams[index]), {
        passive: false,
      });
      this._plug.WAMS[wams[index]].img = img;
    });
    preview.appendChild(this.images);

    refreshImages(select);
    return preview;
  }

  async reloadPresets(presets) {
    this.PresetsBank = presets;

    if (this.presetsMenu) this.presetsMenu.remove();
    this.presetsMenu = await this.loadPreset();
    this.body.appendChild(this.presetsMenu);
  }

  createBoard() {
    this.board = document.createElement("div");
    this.board.id = "board";

    this.dropZone = document.createElement("div");
    this.dropZone.id = "dropZone";
    this.dropZone.ondragover = (e) => e.preventDefault();
    this.dropZone.ondrop = () => {
      let target = this.dropZone.nextSibling;
      this.board.removeChild(this.dropZone);

      this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
      this.board.insertBefore(this.dragOrigin, target);
      this._plug.pedalboardNode.connectNodes(this.board.childNodes);
    };

    return this.board;
  }

  // Add the plugin to the board.
  addPlugin(instance, img, id) {
    instance.createGui().then((gui) => {
      let wrapper = document.createElement("article");
      wrapper.draggable = true;
      wrapper.ondragstart = (event) => {
        event.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
        this.dragOrigin = wrapper;
      };
      wrapper.ondragover = (event) => {
        let target = this.getWrapper(event.path);
        let mid = target.getBoundingClientRect().x + target.getBoundingClientRect().width / 2;
        if (target) {
          this.board.insertBefore(this.dropZone, mid > event.x ? target : target.nextSibling);
        }
      };
      wrapper.ondragend = () => {
        if (this.dropZone.parentElement == this.board) {
          this.board.removeChild(this.dropZone);
        }
      };

      let header = document.createElement("header");
      let title = document.createElement("h2");
      title.innerHTML = instance.name;
      header.appendChild(title);

      let cross = document.createElement("img");
      cross.src = this._crossIMGUrl;
      cross.setAttribute("crossorigin", "anonymous");
      cross.addEventListener("click", () => {
        this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
        this.board.removeChild(wrapper);
        this._plug.pedalboardNode.connectNodes(this.board.childNodes);
      });
      header.append(cross);
      wrapper.appendChild(gui);
      wrapper.id = id;
      wrapper.classList.add("nodeArticle");

      this.board.appendChild(wrapper);
      this.resizeWrapper(wrapper, header, title, cross, gui);
      wrapper.insertBefore(header, gui);
    });
  }

  // Scale the gui of the node to the height of the board;
  resizeWrapper(wrapper, header, title, cross, gui) {
    const scale = 200 / gui.getBoundingClientRect().height;

    wrapper.style.transformOrigin = "top left";
    wrapper.style.transform = "scale(" + scale + ")";

    const width = Math.round(wrapper.getBoundingClientRect().width / scale);
    const height = Math.round(wrapper.getBoundingClientRect().height / scale);

    wrapper.style.width = `${wrapper.getBoundingClientRect().width}px`;
    wrapper.style.height = `${wrapper.getBoundingClientRect().height}px`;

    gui.style.width = `${width}px`;
    gui.style.height = `${height}px`;

    header.style.height = `${Math.round(30 / scale)}px`;
    header.style.width = `${width}px`;
    header.style.borderWidth = `${Math.round(3 / scale)}px`;

    title.style.fontSize = `${100 / scale}%`;
    cross.style.width = `${Math.round(15 / scale)}px`;
    cross.style.height = `${Math.round(15 / scale)}px`;
  }

  // Return the nodeArticle when selecting child node instead of itself with drag and drop.
  getWrapper(path) {
    let pre;
    for (let e of path) {
      if (e.id == "board") {
        return pre;
      }
      pre = e;
    }
    return pre;
  }

  // Create the save panel.
  async loadPreset() {
    let keys = Object.keys(this.PresetsBank);

    let presetsInfos = document.createElement("div");
    presetsInfos.id = "presetsInfos";

    this.banks = this.createBanks(keys);
    this.banks.id = "banks";

    this.presets = document.createElement("ul");
    this.presets.id = "presets";

    this.infos = document.createElement("div");
    this.infos.id = "infos";

    let banks = document.createElement("h1");
    banks.innerHTML = "Banks";
    let presetsTitle = document.createElement("h1");
    presetsTitle.innerHTML = "Presets";
    let infosTitle = document.createElement("h1");
    infosTitle.innerHTML = "Information";

    presetsInfos.appendChild(banks);
    presetsInfos.appendChild(presetsTitle);
    presetsInfos.appendChild(infosTitle);
    presetsInfos.appendChild(this.banks);
    presetsInfos.appendChild(this.presets);
    presetsInfos.appendChild(this.infos);
    return presetsInfos;
  }

  // Create the list of banks.
  createBanks(keys) {
    let banks = document.createElement("ul");

    let button = document.createElement("button");
    button.innerHTML = "New Bank";
    button.classList.add("addBtn");
    button.addEventListener("click", () => {
      const bank = "";
      let presetInput = this.createBankElement(bank);
      this.banks.appendChild(presetInput);
      this.PresetsBank[bank] = {};
      presetInput.lastChild.previousSibling.click();
    });
    banks.appendChild(button);

    keys.forEach((bank) => {
      let el = this.createBankElement(bank);
      banks.appendChild(el);
    });

    return banks;
  }

  // Display the save in the bank.
  displayBank(bankNameCallBack) {
    this.presets.innerHTML = "";
    const bank = bankNameCallBack();
    let button = document.createElement("button");
    button.innerHTML = "New Preset";
    button.classList.add("addBtn");
    button.addEventListener("click", () => {
      const preset = "";
      let presetInput = this.createPresetElement(bankNameCallBack, preset);
      this.presets.appendChild(presetInput);
      this.PresetsBank[bank][preset] = [];
      presetInput.lastChild.previousSibling.click();
    });
    this.presets.appendChild(button);

    Object.keys(this.PresetsBank[bank]).forEach((preset) => {
      this.presets.appendChild(this.createPresetElement(bankNameCallBack, preset));
    });
  }

  // Load the save to the audioNode and show it's informations.
  displayPreset(bankNameCallBack, preset) {
    const bank = bankNameCallBack();
    this.infos.innerHTML = "";
    this._plug.loadPreset(this.PresetsBank[bank][preset]);

    let bnk = document.createElement("h4");
    bnk.innerHTML = `Bank: ${bank}`;

    let name = document.createElement("h4");
    name.innerHTML = `Name: ${preset}`;

    let ul = document.createElement("ul");
    this.PresetsBank[bank][preset].forEach((node) => {
      let li = document.createElement("li");
      li.innerHTML = node.name;
      ul.appendChild(li);
    });

    this.infos.appendChild(bnk);
    this.infos.appendChild(name);
    this.infos.appendChild(ul);
  }

  // Rename a save.
  renamePreset(bank, oldName, newName) {
    if (newName.trim().length == 0) {
      alert("Invalid preset name");
      return false;
    }
    if (newName != oldName) {
      if (this.PresetsBank[bank][newName]) {
        alert("This preset name is already used");
        return false;
      }
      this.PresetsBank[bank][newName] = this.PresetsBank[bank][oldName];
      delete this.PresetsBank[bank][oldName];
    }
    return true;
  }

  // Rename a bank.
  renameBank(oldName, newName) {
    if (newName.trim().length == 0) {
      alert("Invalid bank name");
      return false;
    }
    if (newName != oldName) {
      if (this.PresetsBank[newName]) {
        alert("This bank name is already used");
        return false;
      }
      this.PresetsBank[newName] = this.PresetsBank[oldName];
      delete this.PresetsBank[oldName];
    }
    return true;
  }

  // Delete a save.
  deletePreset(bankNameCallBack, presetNameCallBack, node) {
    delete this.PresetsBank[bankNameCallBack()][presetNameCallBack()];
    this.presets.removeChild(node);
  }

  // Delete a bank if it's empty.
  deleteBank(bankNameCallBack, node) {
    const bank = bankNameCallBack();
    if (Object.keys(this.PresetsBank[bank]).length != 0) {
      alert("Empty the bank before trying to delete it");
    } else {
      delete this.PresetsBank[bank];
      this.banks.removeChild(node);
    }
  }

  // Create a save modifiable with the buttons to it's right, it can hold the informations about the plugins.
  createPresetElement(bankNameCallBack, presetName) {
    const bank = bankNameCallBack();

    let el = document.createElement("li");
    el.classList.add("presetElement");

    let text = document.createElement("span");
    text.innerHTML = presetName;
    const clickEventCallBack = () => this.displayPreset(bankNameCallBack, text.innerHTML);
    text.addEventListener("click", clickEventCallBack);
    el.append(text);

    let input = document.createElement("input");
    input.addEventListener("keyup", (e) => {
      if (e.key == "Enter") input.blur();
    });
    input.addEventListener("blur", (e) => {
      if (this.renamePreset(bank, e.target.placeholder, e.target.value)) {
        text.innerHTML = e.target.value;
        text.addEventListener("click", clickEventCallBack);
      } else {
        setTimeout(() => input.focus(), 1);
      }
    });

    el.append(
      this.createLiButton(this._saveSVGUrl, "SAVE", () => {
        this._plug.pedalboardNode
          .getState(this.board.childNodes)
          .then((state) => (this.PresetsBank[bank][text.innerHTML] = state.current));
      })
    );

    el.append(
      this.createLiButton(this._editSVGUrl, "EDIT", () => {
        text.removeEventListener("click", clickEventCallBack);
        input.value = text.innerHTML;
        input.placeholder = input.value;
        text.innerHTML = "";
        text.appendChild(input);
        input.focus();
      })
    );

    el.append(
      this.createLiButton(this._deleteSVGUrl, "DELETE", () =>
        this.deletePreset(bankNameCallBack, () => text.innerHTML, el)
      )
    );

    return el;
  }

  // Create a bank modifiable with the buttons to it's right, it can hold multiples saves.
  createBankElement(name) {
    let el = document.createElement("li");
    el.classList.add("bankElement");

    const clickEventCallBack = () => this.displayBank(() => text.innerHTML);

    let text = document.createElement("span");
    text.innerHTML = name;
    text.addEventListener("click", clickEventCallBack);
    el.appendChild(text);

    let input = document.createElement("input");
    input.addEventListener("keyup", (e) => {
      if (e.key == "Enter") input.blur();
    });
    input.addEventListener("blur", (e) => {
      if (this.renameBank(e.target.placeholder, e.target.value)) {
        text.innerHTML = e.target.value;
        text.addEventListener("click", clickEventCallBack);
      } else {
        setTimeout(() => input.focus(), 1);
      }
    });

    el.append(
      this.createLiButton(this._editSVGUrl, "EDIT", () => {
        text.removeEventListener("click", clickEventCallBack);
        input.value = text.innerHTML;
        input.placeholder = input.value;
        text.innerHTML = "";
        text.appendChild(input);
        input.focus();
      })
    );

    el.append(this.createLiButton(this._deleteSVGUrl, "DELETE", () => this.deleteBank(() => text.innerHTML, el)));

    return el;
  }

  // Create a button for a bank or a save
  createLiButton(url, alt, callback) {
    let img = document.createElement("img");
    img.setAttribute("crossorigin", "anonymous");
    img.setAttribute("src", url);
    img.setAttribute("alt", alt);
    img.addEventListener("click", callback);
    img.classList.add("listElementButton");
    return img;
  }

  //Return DataWidth and DataHeight values
  get properties() {
    const bbox = this.getBoundingClientRect();
    return { dataWidth: { value: bbox.width }, dataHeight: { value: bbox.height } };
  }

  // Link the css
  setStyle() {
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("crossorigin", "anonymous");
    linkElem.setAttribute("href", `${this._baseURL}/style.css`);

    this._root.appendChild(linkElem);
  }
}

customElements.define("wap-pedalboard", pedalboardGui);
