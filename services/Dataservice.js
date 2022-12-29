var dataservice = (function (){
   
  function Dataservice(){
    this.baseUrl = 'https://freddy.codesubmit.io';
  }

  /**
   * 
   * @param {string} uri 
   */
  Dataservice.prototype.sendRequest = async function(route) {
    //check if user access_token has expired
    if(!authService.isAccessTokenValid()){
      // fetch refresh token
      await authService.refreshToken();
    }
    const { access: { token } } = localStorageHelper.getItem(USER_TOKEN);
    const response = await fetch(`${this.baseUrl}${route}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
    });
    return await response.json();
  }

  Dataservice.prototype.getDashboardData = async function(){
    const { dashboard } = await this.sendRequest('/dashboard');
    return dashboard;
  }

  Dataservice.prototype.getOrders = async function(page = 1, query='') {
    const response = await this.sendRequest(`/orders?page=${page}&q=${query}`);
    return response;
  }

  return new Dataservice();
}());
