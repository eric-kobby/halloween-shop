var formatHelper = (function() {

  function FormatHelper (){}

  /**
   * Converts regular number into a compact number
   * @param {number} num 
   *
   */
  FormatHelper.prototype.convertToCompactNumber = function(num){
    return Intl.NumberFormat('en-US', { 
      notation: 'compact', 
      style: 'currency',
      currency: 'USD' }).format(num);
  }

  /**
   * 
   * @param {Date} date 
   * @returns 
   */
  FormatHelper.prototype.formatDate = function(date){
    return Intl.DateTimeFormat('en-US').format(date);
  }

  /**
   * Escapes text that came from a third party before it is put into innerHTML.
   * @param {string} value
   * @returns {string}
   */
  FormatHelper.prototype.escapeHtml = function(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(character){
      switch (character) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        default: return '&#39;';
      }
    });
  }

  return new FormatHelper();
})();