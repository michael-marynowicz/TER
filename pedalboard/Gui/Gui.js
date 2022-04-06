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

  _presetsUrl = `${this._baseURL.slice(0, this._baseURL.lastIndexOf("/"))}/presets.json`;

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

  PRESETS = {};

  /**
   * Initlialise the differents elements of the gui. The PedalBoard is made from 3 sections, the
   * thumnails to select the WAM to add, the board where you can see the Gui of the
   * plugins and you can drag and drop them to change the order or remove them with the
   * cross and the presets section where you can save and load presets.
   * @author Quentin Beauchet
   */
  async init() {
    this.setStyle();
    this.body = document.createElement("body");

    this.preview = await this.loadThumbnails();
    this.createBoard();
    this.presetsMenu = await this.loadPresets();

    this.body.appendChild(this.preview);
    this.body.appendChild(this.board);
    this.body.appendChild(this.presetsMenu);

    this._root.appendChild(this.body);
  }

  /**
   * Loads the thumbnails for the plugins and create a filter selector based on their
   * keywords in their respective descriptor.json and for each image it had an event listener
   * to add the plugin to the board when clicked.
   * It needs to be asynchonous to be consistant each time in the order of the loaded plugins.
   * @returns The thumbail section.
   * @author Quentin Beauchet
   */
  async loadThumbnails() {
    let pedals = Object.keys(this._plug.WAMS);
    let keywords = { all: [] };
    let urls = await Promise.all(
      pedals.map((el) => {
        let pedal = this._plug.WAMS[el];
        keywords["all"].push(el);
        pedal.descriptor.keywords.forEach((k) => {
          if (!(k in keywords)) {
            keywords[k] = [];
          }
          keywords[k].push(el);
        });
        let thumbnail = pedal.descriptor.thumbnail;
        if (thumbnail == "") {
          return this._notFoundIMGUrl;
        }
        return `${pedal.url}${thumbnail}`;
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
      img.addEventListener("click", () => this._plug.addWAM(pedals[index]), {
        passive: false,
      });
      this._plug.WAMS[pedals[index]].img = img;
    });
    preview.appendChild(this.images);

    refreshImages(select);
    return preview;
  }

  /**
   * Create the board and a dropZone to allow a change in order of the plugins.
   * @returns The board section where the guis from the pedals are listed.
   * @author Quentin Beauchet
   */
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

  /**
   * Create the gui for the plugin and then the wrapper around it.
   * We need to resize it with resizeWrapper at the end.
   * @param {WebAudioModule} instance
   * @param {HTMLElement} img
   * @param {int} id
   * @author Quentin Beauchet
   */
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

  /**
   * Scale the gui of the plugin.
   * @param {HTMLElement} wrapper
   * @param {HTMLElement} header
   * @param {HTMLElement} title
   * @param {HTMLElement} cross
   * @param {HTMLElement} gui
   * @author Quentin Beauchet
   */
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

  /**
   * Return the nodeArticle when selecting child node instead of itself with drag and drop.
   * @param {HTMLElement[]} path
   * @returns The wrapper selected.
   */
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
  async loadPresets() {
    let file = await fetch(this._presetsUrl);
    this.PRESETS = await file.json();

    let keys = Object.keys(this.PRESETS);

    let presetsInfos = document.createElement("div");
    presetsInfos.id = "presetsInfos";

    this.banks = this.createBanks(keys);
    this.banks.id = "banks";

    this.presets = document.createElement("ul");
    this.presets.id = "presets";

    this.infos = document.createElement("div");
    this.infos.id = "infos";

    let banksTitle = document.createElement("h1");
    banksTitle.innerHTML = "Banks";
    let presetsTitle = document.createElement("h1");
    presetsTitle.innerHTML = "Presets";
    let infosTitle = document.createElement("h1");
    infosTitle.innerHTML = "Information";

    presetsInfos.appendChild(banksTitle);
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
      this.PRESETS[bank] = [];
      presetInput.lastChild.previousSibling.click();
    });
    banks.appendChild(button);

    keys.forEach((bank) => {
      let el = this.createBankElement(bank);
      banks.appendChild(el);
    });

    return banks;
  }

  // Display the save in the banks.
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
      this.PRESETS[bank][preset] = [];
      presetInput.lastChild.previousSibling.click();
    });
    this.presets.appendChild(button);

    Object.keys(this.PRESETS[bank]).forEach((preset) => {
      this.presets.appendChild(this.createPresetElement(bankNameCallBack, preset));
    });
  }

  // Load the save to the audioNode and show it's informations.
  loadPreset(bankNameCallBack, preset) {
    const bank = bankNameCallBack();
    this.infos.innerHTML = "";
    this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
    this.board.innerHTML = "";
    this._plug.loadState(this.PRESETS[bank][preset]);

    let cat = document.createElement("h4");
    cat.innerHTML = `Categorie: ${bank}`;

    let name = document.createElement("h4");
    name.innerHTML = `Name: ${preset}`;

    let ul = document.createElement("ul");
    this.PRESETS[bank][preset].waps.forEach((node) => {
      let li = document.createElement("li");
      li.innerHTML = node.name;
      ul.appendChild(li);
    });

    this.infos.appendChild(cat);
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
      if (this.PRESETS[bank][newName]) {
        alert("This preset name is already used");
        return false;
      }
      this.PRESETS[bank][newName] = this.PRESETS[bank][oldName];
      delete this.PRESETS[bank][oldName];
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
      if (this.PRESETS[newName]) {
        alert("This bank name is already used");
        return false;
      }
      this.PRESETS[newName] = this.PRESETS[oldName];
      delete this.PRESETS[oldName];
    }
    return true;
  }

  // Delete a save.
  deletePreset(bankNameCallBack, presetsNameCallBack, node) {
    delete this.PRESETS[bankNameCallBack()][presetsNameCallBack()];
    this.presets.removeChild(node);
  }

  /**
   * Delete a bank if it's empty.
   * @param {function} bankNameCallBack
   * @param {HTMLElement} node
   */
  deleteBank(bankNameCallBack, node) {
    const bank = bankNameCallBack();
    if (Object.keys(this.PRESETS[bank]).length != 0) {
      alert("Empty the bank before trying to delete it");
    } else {
      delete this.PRESETS[bank];
      this.banks.removeChild(node);
    }
  }

  /**
   * Create a preset editable with the buttons to it's right, it can save the onfiguration of the board.
   * @param {function} bankNameCallBack
   * @param {string} presetName
   * @returns The preset HTMLElement.
   * @author Quentin Beauchet
   */
  createPresetElement(bankNameCallBack, presetName) {
    const bank = bankNameCallBack();

    let preset = document.createElement("li");
    preset.classList.add("presetElement");

    let text = document.createElement("span");
    text.innerHTML = presetName;
    const clickEventCallBack = () => this.loadPreset(bankNameCallBack, text.innerHTML);
    text.addEventListener("click", clickEventCallBack);
    preset.append(text);

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

    preset.append(
      this.createLiButton(this._saveSVGUrl, "SAVE", () => {
        this._plug.pedalboardNode.getState(this.board.childNodes).then((preset) => {
          this.PRESETS[bank][text.innerHTML] = preset;
        });
      })
    );

    preset.append(
      this.createLiButton(this._editSVGUrl, "EDIT", () => {
        text.removeEventListener("click", clickEventCallBack);
        input.value = text.innerHTML;
        input.placeholder = input.value;
        text.innerHTML = "";
        text.appendChild(input);
        input.focus();
      })
    );

    preset.append(
      this.createLiButton(this._deleteSVGUrl, "DELETE", () =>
        this.deletePreset(bankNameCallBack, () => text.innerHTML, preset)
      )
    );

    return preset;
  }

  /**
   * Create a bank editable with the buttons to it's right, it can hold multiples presets.
   * @param {string} name
   * @returns The bank HTMLElement.
   * @author Quentin Beauchet
   */
  createBankElement(name) {
    let bank = document.createElement("li");
    bank.classList.add("bankElement");

    const clickEventCallBack = () => this.displayBank(() => text.innerHTML);

    let text = document.createElement("span");
    text.innerHTML = name;
    text.addEventListener("click", clickEventCallBack);
    bank.appendChild(text);

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

    bank.append(
      this.createLiButton(this._editSVGUrl, "EDIT", () => {
        text.removeEventListener("click", clickEventCallBack);
        input.value = text.innerHTML;
        input.placeholder = input.value;
        text.innerHTML = "";
        text.appendChild(input);
        input.focus();
      })
    );

    bank.append(this.createLiButton(this._deleteSVGUrl, "DELETE", () => this.deleteBank(() => text.innerHTML, bank)));

    return bank;
  }

  /**
   * Create a button (img) for a bank or a preset.
   * @param {string} url
   * @param {string} alt
   * @param {function} callback
   * @returns The button HTMLElement.
   * @author Quentin Beauchet
   */
  createLiButton(url, alt, callback) {
    let img = document.createElement("img");
    img.setAttribute("crossorigin", "anonymous");
    img.setAttribute("src", url);
    img.setAttribute("alt", alt);
    img.addEventListener("click", callback);
    img.classList.add("listElementButton");
    return img;
  }

  /**
   * Return DataWidth and DataHeight values.
   */
  get properties() {
    const bbox = this.getBoundingClientRect();
    return { dataWidth: { value: bbox.width }, dataHeight: { value: bbox.height } };
  }

  /**
   * Link the css.
   * @author Quentin Beauchet
   */
  setStyle() {
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("crossorigin", "anonymous");
    linkElem.setAttribute("href", `${this._baseURL}/style.css`);

    this._root.appendChild(linkElem);
  }
}

customElements.define("wap-pedalboard", pedalboardGui);
