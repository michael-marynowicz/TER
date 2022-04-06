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

  _savesUrl = `${this._baseURL.slice(0, this._baseURL.lastIndexOf("/"))}/saves.json`;

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
    this.saveMenu = await this.loadSaves();

    this.body.appendChild(this.preview);
    this.body.appendChild(this.board);
    this.body.appendChild(this.saveMenu);

    this._root.appendChild(this.body);
  }

  // Load the thumbnails of the plugins
  async loadThumbnails() {
    let pedals = Object.keys(this._plug.pedals);
    let keywords = { all: [] };
    let urls = await Promise.all(
      pedals.map((el) => {
        let pedal = this._plug.pedals[el];
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
        this.images.appendChild(this._plug.pedals[el].img);
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
      img.addEventListener("click", () => this._plug.addPedal(pedals[index]), {
        passive: false,
      });
      this._plug.pedals[pedals[index]].img = img;
    });
    preview.appendChild(this.images);

    refreshImages(select);
    return preview;
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
  async loadSaves() {
    let file = await fetch(this._savesUrl);
    this.folders = await file.json();
    

    let keys = Object.keys(this.folders);

    let savesInfos = document.createElement("div");
    savesInfos.id = "savesInfos";

    this.categories = this.createCategories(keys);
    this.categories.id = "categories";

    this.saves = document.createElement("ul");
    this.saves.id = "saves";

    this.infos = document.createElement("div");
    this.infos.id = "infos";

    let categoriesTitle = document.createElement("h1");
    categoriesTitle.innerHTML = "Categories";
    let savesTitle = document.createElement("h1");
    savesTitle.innerHTML = "Saves";
    let infosTitle = document.createElement("h1");
    infosTitle.innerHTML = "Information";

    savesInfos.appendChild(categoriesTitle);
    savesInfos.appendChild(savesTitle);
    savesInfos.appendChild(infosTitle);
    savesInfos.appendChild(this.categories);
    savesInfos.appendChild(this.saves);
    savesInfos.appendChild(this.infos);
    return savesInfos;
  }

  // Create the list of categories.
  createCategories(keys) {
    let categories = document.createElement("ul");

    let button = document.createElement("button");
    button.innerHTML = "New Categorie";
    button.classList.add("addBtn");
    button.addEventListener("click", () => {
      const categorie = "";
      let saveInput = this.createCategorieElement(categorie);
      this.categories.appendChild(saveInput);
      this.folders[categorie] = [];
      saveInput.lastChild.previousSibling.click();
    });
    categories.appendChild(button);

    keys.forEach((categorie) => {
      let el = this.createCategorieElement(categorie);
      categories.appendChild(el);
    });

    return categories;
  }

  // Display the save in the categorie.
  displayCategorie(categorieNameCallBack) {
    this.saves.innerHTML = "";
    const categorie = categorieNameCallBack();
    let button = document.createElement("button");
    button.innerHTML = "New Save";
    button.classList.add("addBtn");
    button.addEventListener("click", () => {
      const save = "";
      let saveInput = this.createSaveElement(categorieNameCallBack, save);
      this.saves.appendChild(saveInput);
      this.folders[categorie][save] = [];
      saveInput.lastChild.previousSibling.click();
    });
    this.saves.appendChild(button);

    Object.keys(this.folders[categorie]).forEach((save) => {
      this.saves.appendChild(this.createSaveElement(categorieNameCallBack, save));
    });
  }

  // Load the save to the audioNode and show it's informations.
  loadSave(categorieNameCallBack, save) {
    const categorie = categorieNameCallBack();
    this.infos.innerHTML = "";
    this._plug.pedalboardNode.disconnectNodes(this.board.childNodes);
    this.board.innerHTML = "";
    this._plug.loadSave(this.folders[categorie][save]);

    let cat = document.createElement("h4");
    cat.innerHTML = `Categorie: ${categorie}`;

    let name = document.createElement("h4");
    name.innerHTML = `Name: ${save}`;

    let ul = document.createElement("ul");
    this.folders[categorie][save].forEach((node) => {
      let li = document.createElement("li");
      li.innerHTML = node.name;
      ul.appendChild(li);
    });

    this.infos.appendChild(cat);
    this.infos.appendChild(name);
    this.infos.appendChild(ul);
  }

  // Rename a save.
  renameSave(categorie, oldName, newName) {
    if (newName.trim().length == 0) {
      alert("Invalid save name");
      return false;
    }
    if (newName != oldName) {
      if (this.folders[categorie][newName]) {
        alert("This save name is already used");
        return false;
      }
      this.folders[categorie][newName] = this.folders[categorie][oldName];
      delete this.folders[categorie][oldName];
    }
    return true;
  }

  // Rename a categorie.
  renameCategorie(oldName, newName) {
    if (newName.trim().length == 0) {
      alert("Invalid categorie name");
      return false;
    }
    if (newName != oldName) {
      if (this.folders[newName]) {
        alert("This categorie name is already used");
        return false;
      }
      this.folders[newName] = this.folders[oldName];
      delete this.folders[oldName];
    }
    return true;
  }

  // Delete a save.
  deleteSave(categorieNameCallBack, saveNameCallBack, node) {
    delete this.folders[categorieNameCallBack()][saveNameCallBack()];
    this.saves.removeChild(node);
  }

  // Delete a categorie if it's empty.
  deleteCategorie(categorieNameCallBack, node) {
    const categorie = categorieNameCallBack();
    if (Object.keys(this.folders[categorie]).length != 0) {
      alert("Empty the categorie before trying to delete it");
    } else {
      delete this.folders[categorie];
      this.categories.removeChild(node);
    }
  }

  // Create a save modifiable with the buttons to it's right, it can hold the informations about the plugins.
  createSaveElement(categorieNameCallBack, saveName) {
    const categorie = categorieNameCallBack();

    let el = document.createElement("li");
    el.classList.add("saveElement");

    let text = document.createElement("span");
    text.innerHTML = saveName;
    const clickEventCallBack = () => this.loadSave(categorieNameCallBack, text.innerHTML);
    text.addEventListener("click", clickEventCallBack);
    el.append(text);

    let input = document.createElement("input");
    input.addEventListener("keyup", (e) => {
      if (e.key == "Enter") input.blur();
    });
    input.addEventListener("blur", (e) => {
      if (this.renameSave(categorie, e.target.placeholder, e.target.value)) {
        text.innerHTML = e.target.value;
        text.addEventListener("click", clickEventCallBack);
      } else {
        setTimeout(() => input.focus(), 1);
      }
    });

    el.append(
      this.createLiButton(this._saveSVGUrl, "SAVE", () => {
        this._plug.pedalboardNode.getState(this.board.childNodes).then((save) => {
          this.folders[categorie][text.innerHTML] = save;
        });
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
        this.deleteSave(categorieNameCallBack, () => text.innerHTML, el)
      )
    );

    return el;
  }

  // Create a categorie modifiable with the buttons to it's right, it can hold multiples saves.
  createCategorieElement(name) {
    let el = document.createElement("li");
    el.classList.add("categorieElement");

    const clickEventCallBack = () => this.displayCategorie(() => text.innerHTML);

    let text = document.createElement("span");
    text.innerHTML = name;
    text.addEventListener("click", clickEventCallBack);
    el.appendChild(text);

    let input = document.createElement("input");
    input.addEventListener("keyup", (e) => {
      if (e.key == "Enter") input.blur();
    });
    input.addEventListener("blur", (e) => {
      if (this.renameCategorie(e.target.placeholder, e.target.value)) {
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

    el.append(this.createLiButton(this._deleteSVGUrl, "DELETE", () => this.deleteCategorie(() => text.innerHTML, el)));

    return el;
  }

  // Create a button for a categorie or a save
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
