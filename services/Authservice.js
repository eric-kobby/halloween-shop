const authService = (function () {
  function AuthService() {
    this.baseUrl = "https://freddy.codesubmit.io";
    const auth = this;
    //register logout click
    document.querySelector('#logout')?.addEventListener('click', function(){
      auth.logout();
    });
  }


  AuthService.prototype.login = async function (username, password) {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          "content-Type": 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  AuthService.prototype.updateAccessToken = function(access_token) {
    const date = new Date();
    const userToken = localStorageHelper.getItem('USER_TOKEN');
    const newAccesTokenOption = {
      ...userToken,
      access: {
        token: access_token,
        expiry:  new Date(new Date().setMinutes(date.getMinutes() + 15))
      }
    };
    localStorageHelper.setItem(USER_TOKEN, newAccesTokenOption);
  }

  AuthService.prototype.persistUserToken = function ({ access_token, refresh_token }) {
    const date = new Date();
    const options = {
      access: {
        token: access_token,
        expiry: new Date(new Date().setMinutes(date.getMinutes() + 15))
      },
      refresh: {
        token: refresh_token,
        expiry: new Date(new Date().setDate(date.getDate() + 30)),
      }
    }
    localStorageHelper.setItem(USER_TOKEN, options);
  }

  AuthService.prototype.isAccessTokenValid = function () {
    const userToken = localStorageHelper.getItem(USER_TOKEN);
    if (!userToken) this.logout();
    const { access } = userToken;
    const expiry = new Date(access.expiry);
    //check if access_token has expired
    return expiry >= new Date();
  }

  AuthService.prototype.isRefreshTokenValid = function () {
    const userToken = localStorageHelper.getItem(USER_TOKEN);
    if (!userToken) this.logout();

    const { refresh } = userToken;
    const expiry = new Date(refresh.expiry);
    //check if refresh_token has expired
    return expiry >= new Date();
  }

  AuthService.prototype.refreshToken = async function () {
    try {
      const { refresh: { token } } = localStorageHelper.getItem(USER_TOKEN);
      // sign out user when refesh token has also expired
      if (!this.isRefreshTokenValid()) this.logout();

      // fetch refresh token
      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const { access_token } = await response.json();
      // update access token
      this.updateAccessToken(access_token);
    }
    catch (error) { throw error; }
  }

  AuthService.prototype.logout = function () {
    //get user token meta data
    localStorage.removeItem(USER_TOKEN);
    // redirect user to login page
    window.location.href = window.location.origin;
  }
  return new AuthService();
}());
