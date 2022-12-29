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

  return new FormatHelper();
})();