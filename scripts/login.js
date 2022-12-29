(function(){
  
  const loginForm = document.querySelector('#login-form');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    // getting user inputs
    const usernameEl =  document.querySelector('#username');
    const passwordEl =  document.querySelector('#password');
    // authenticating user
    try {
      const { msg, access_token, refresh_token } = await authService.login(usernameEl.value, passwordEl.value);
      if (msg) return alert(msg);
      //persist user token to localstorage
      authService.persistUserToken({ access_token, refresh_token });
      //redirect to dashboard page
      window.location.href = "../pages/Dashboard.html";
    } catch(error){
      //show an error toast || some logging to sentry
      console.error(error);
      alert('An error occured while trying to login.');
    }
  })

})();