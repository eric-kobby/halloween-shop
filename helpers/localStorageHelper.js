const localStorageHelper = (function() {
  
  function LocalStorageHelper() {  }
  /**
   * 
   * @param {string} key 
   */
   LocalStorageHelper.prototype.getItem = function (key) {
    const item = localStorage.getItem(key);
    return item !== null && JSON.parse(item);
  }

  /**
   * 
   * @param {string} key 
   * @param { any } data
   */
   LocalStorageHelper.prototype.setItem = function (key, data) {

    localStorage.setItem(key, JSON.stringify(data));
  }
  return new LocalStorageHelper();
  
}());
