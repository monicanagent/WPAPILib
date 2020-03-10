/**
* @file A self-hosted WordPress API library for Node.js
* @version 0.0.1
* @author Patrick Bay (monican_agent)
* @copyright MIT License
*
*/
const http = require('http');
const https = require('https');
const http2 = require('http2');
const querystring = require('querystring');

/**
* @class WordPress API library.
*/
module.exports = class WPAPILib {

  /**
  * Creates a new instance of WPAPILib
  *
  * @param {String} blogURL The full base URL to the blog (e.g. https://www.myblogsite.com)
  */
   constructor(blogURL) {
     this._baseURL = new URL(blogURL);
   }

   /**
   * @property {String} version The WPAPILib version. This information
   * is included in the "User-Agent" header of API requests.
   * @readonly
   */
   get version() {
     return ("v0.0.1");
   }

   /**
   * @property {String} userAgent The string used for the "User-Agent" header
   * of API requests.
   * @readonly
   */
   get userAgent() {
     return (`WPAPILib/${this.version} (Node.js/${process.version})`);
   }

   /**
   * @property {Boolean} authenticated True if authentication cookies have
   * been set from a successful [login]{@link WPAPILib#login}. This value
   * does <b>not</b> indicate whether or not the [APINonce]{@link WPAPILib#APINonce}
   * has been set.
   * @readonly
   */
   get authenticated() {
     if ((this._authCookies == null) || (this._authCookies == undefined)) {
       return (false);
     }
     if (this._authCookies.length == 0) {
       return (false);
     }
     return (true);
   }

   /**
   * @property {String} authHeader A single string that can be used as a "Cookie"
   " HTTP header containing the authentication cookies set from a successful
   * [login]{@link WPAPILib#login}, or <code>null</code> if they haven't been set.
   * @readonly
   */
   get authHeader() {
     if ((this._authCookies == null) || (this._authCookies == undefined)) {
       return (null);
     }
     if (this._authCookies.length == 0) {
       return (null);
     }
     var headerString = this._authCookies.join("; ");
     return (headerString);
   }

   /**
   * @property {Boolean} useHTTP2 <code>true</code> if server requests should use
   * HTTP/2, <code>false</code> if they should use HTTP/1.1
   * @readonly
   */
   get useHTTP2() {
     if ((this._useHTTP2 == undefined) || (this._useHTTP2 == null)) {
       this._useHTTP2 = false;
     }
     return (this._useHTTP2);
   }

   /**
   * @property {Object} APISettings Contains various API settings retrieved
   * from the WordPress server.
   * @readonly
   */
   get APISettings() {
     if ((this._APISettings == null) || (this._APISettings == undefined)) {
       return (null);
     }
     return (this._APISettings);
   }

   /**
   * @property {String} APIRootURL The root or base API URL retrieved
   * from the WordPress server. This is the <code>root</code> value of
   * the [APISettings]{@link WPAPILib#APISettings} object, or <code>null</code>
   * if it doesn't exist.
   * @readonly
   */
   get APIRootURL() {
     if (this.APISettings == null) {
       return (null);
     }
     return (this.APISettings.root);
   }

   /**
   * @property {String} APINonce The API nonce value (commonly used as "_wpnonce"),
   * retrieved from the WordPress server. This is the <code>nonce</code> value of
   * the [APISettings]{@link WPAPILib#APISettings} object, or <code>null</code>
   * if it doesn't exist.
   * @readonly
   */
   get APINonce (){
     if (this.APISettings == null) {
       return (null);
     }
     return (this.APISettings.nonce);
   }

   /**
   * @property {String} APIVersionString The API version string typically appended
   * to the main URL to form a base API path. This is the <code>versionString</code> value of
   * the [APISettings]{@link WPAPILib#APISettings} object, or <code>null</code>
   * if it doesn't exist.
   * @readonly
   */
   get APIVersionString (){
     if (this.APISettings == null) {
       return (null);
     }
     return (this.APISettings.versionString);
   }

   /**
   * @property {String} [APIGateway="?rest_route/"] The API gateway or base
   * route used to construct the API URL. This is the <code>gateway</code> value of the
   * [APISettings]{@link WPAPILib#APISettings} object or the default value if
   * it doesn't exist.
   * @readonly
   */
   get APIGateway (){
     if (this.APISettings == null) {
       //this may also be "wp-json" if available, but the following is more reliable:
       return ("?rest_route/");
     }
     return (this.APISettings.gateway);
   }

   /**
   * Logs into the specified blog and, if successful, sets authentication
   * cookies and nonce for subsequent API calls.
   *
   * @param {String} loginName A blog administrator login name.
   * @param {String} loginPassword The password for the administrator login name.
   * @param {String} [loginPath="wp-login.php"] The WordPress login server script
   * to use to log in.
   *
   * @return {Promise} The promise resolves with an object containing the login
   * <code>request</code>, the server <code>response</code> and <code>status</code>
   * code, the <code>authCookies</code> (authentication cookies), and an
   * <code>APISettings</code> object containing post-login information about
   * the API.
   *
   * @async
   */
   async login(loginName, loginPassword, loginPath="wp-login.php") {
     var loginParams = new Object();
     loginParams.log = loginName;
     loginParams.pwd = loginPassword;
     var reqResObj=this.buildRequest(loginPath, loginParams, "POST");
     try {
       reqResObj.request.end();
     } catch (error) {
     }
     await reqResObj.promise;
     var request = reqResObj.request;
     var response = reqResObj.response;
     var status = response.statusCode;
     var headers = response.headers;
     if (this.isHTTP2Upgrade(response.headers) == true) {
       this._useHTTP2 = true;
       var reqResObj=this.buildRequest(loginPath, loginParams, "POST");
       try {
         reqResObj.request.end();
       } catch (error) {
       }
       await reqResObj.promise;
       request = reqResObj.request;
       response = reqResObj.response;
       status = response.statusCode;
       headers = response.headers;
     }
     var cookiesDesc = Object.getOwnPropertyDescriptor(headers, 'set-cookie');
     if (cookiesDesc == undefined) {
       throw (new Error("No cookies received in server response."));
     }
     if ((cookiesDesc.value == "") || (cookiesDesc.value == null)) {
       throw (new Error("Empty cookies received in server response."));
     }
     this._authCookies = new Array();
     for (var count=0; count < cookiesDesc.value.length; count++) {
       if (cookiesDesc.value[count].startsWith("wordpress_") ||
           cookiesDesc.value[count].startsWith("wp_")) {
         this._authCookies.push(cookiesDesc.value[count].split(";")[0]);
       }
     }
     if (this._authCookies.length == 0) {
       throw (new Error("Authentication cookies not received in server response."));
     }
     await this.getAPISettings();
     var loginObj = new Object();
     loginObj.request = request;
     loginObj.response = response;
     loginObj.status = status;
     loginObj.authCookies = this._authCookies;
     loginObj.APISettings = this.APISettings;
     return (loginObj);
   }

   /**
   * Checks a HTTP headers object for HTTP/2 upgrade requirements.
   *
   * @param {Object} headers A HTTP headers object received from a server.
   *
   * @return {Boolean} <code>true</code> if the headers contain HTTP/2 upgrade
   * information, <code>false</code> otherwise.
   *
   * @see https://tools.ietf.org/html/rfc7540#section-3.2
   */
   isHTTP2Upgrade(headers) {
     var connectionDesc = Object.getOwnPropertyDescriptor(headers, 'connection');
     var upgradeDesc = Object.getOwnPropertyDescriptor(headers, 'upgrade');
     if ((connectionDesc == undefined) || (upgradeDesc == undefined)) {
       return (false);
     }
     if ((upgradeDesc.value == "") || (upgradeDesc.value == null)) {
       //incorrect header format
       return (false);
     }
     if ((connectionDesc.value == "") || (connectionDesc.value == null)) {
       //incorrect header format
       return (false);
     }
     if (connectionDesc.value.toLowerCase().includes("upgrade") == false) {
       //not an upgrade connection header
       return (false);
     }
     var upgradeTypes = upgradeDesc.value.split(",");
     for (var count = 0; count < upgradeTypes.length; count++) {
       var currentType = upgradeTypes[count].trim().toLowerCase();
       if ((currentType == "h2") || (currentType == "h2c")) {
         //HTTP/2 secure or HTTP/2 cleartext (non-secure) upgrade request
         return (true);
       }
     }
     //no recognized upgrade protocol type found
     return (false);
   }

   /**
   * Retrieves and parses the WordPress API settings.
   *
   * @param {Boolean} [updateURL=true] If true, the internal <code>_baseURL</code>
   * instance is updated with the URL retrieved from the server, otherwise
   * the internal URL set at instantiation is kept.
   *
   * @return {Promise} The promise resolves <code>true</code> if the API
   * settings could be succesfully retrieved and parsed, <code>false</code>
   * otherwise. The promise rejects (throws) with an <code>Error</code> if
   * authentication has not successfully completed (via [login]{@link WPAPILib#login}).
   *
   * @async
   */
   async getAPISettings(updateURL=true) {
     if (this.authenticated == false) {
       throw (new Error(`You must be authenticated (login) before getting API settings.`));
     }
     //thanks to: https://wordpress.org/support/topic/cant-connect-to-wordpress-rest-api-without-a-plugin/
     var nonceContainerPath = "wp-admin/post-new.php";
     var nonceSettingsDelimiter = "var wpApiSettings";
     var nonceReqRes=this.buildRequest(nonceContainerPath, null, "GET");
     try {
       nonceReqRes.request.end();
     } catch (error) {
       return (false);
     }
     await nonceReqRes.promise;
     var settingsIndex = nonceReqRes.data.indexOf(nonceSettingsDelimiter);
     var objStartIndex = nonceReqRes.data.indexOf("{",settingsIndex);
     var objEndIndex = nonceReqRes.data.indexOf("};",settingsIndex) + 1;
     var wpApiSettingsStr = nonceReqRes.data.substring(objStartIndex, objEndIndex);
     this._APISettings = JSON.parse(wpApiSettingsStr);
     if (updateURL == true) {
       this._baseURL = new URL(this._APISettings.root);
       this._APISettings.gateway = this._baseURL.search;
     } else {
       this._APISettings.gateway = "?rest_route/";
     }
     return (true);
   }

   /**
   * Calls a WordPress API endpoint. This function should only be called
   * after a successful [login]{@link WPAPILib#login} (although some API
   * endpoints are available without authentication).
   *
   * @param {String} endpoint The API enpoint to invoke (e.g. "users/me")
   * @param {Object|String} [params=null] The parameters to include with the
   * API call. If <code>null</code>, no parameters will be sent. If this
   * is an object, it will be parsed into a URL query string. If this is
   * a string, it must be a query string since it will be used as is.
   * @param {String} [method="POST"] The method used to send paramaters with
   * the API call. Valid values include "POST" and "GET" ("PUT" may also work but
   * it's currently not recommended).
   * @param {String} [method="POST"] The method used to send paramaters with
   * the API call. Valid values include "POST" and "GET" ("PUT" may also work but
   * it's currently not recommended).

   * @return {Promise} The promise resolves <code>true</code> if the API
   * settings could be succesfully retrieved and parsed, <code>false</code>
   * otherwise. The promise rejects (throws) with an <code>Error</code> if
   * authentication has not successfully completed (via [login]{@link WPAPILib#login}).
   *
   * @async
   */
   async callAPI(endpoint, params=null, method="POST", useAuth=true) {
     if ((this.authenticated == false) && (useAuth == true)) {
       throw (new Error(`API call "${route}" requires authentication.`));
     }
     var route = this.APIGateway + this.APIVersionString + endpoint;
     route = route.split("//").join("/");
     var reqResObj = this.buildRequest(route, params, method, useAuth);
     try {
       reqResObj.request.end();
     } catch (error) {
     }
     await reqResObj.promise;
     var responseObj = new Object();
     responseObj.request = reqResObj.request;
     responseObj.response = reqResObj.response;
     responseObj.status = reqResObj.response;
     responseObj.data = reqResObj.data;
     return (responseObj);
   }

   /**
   * Builds a WordPress API request. The request will not be sent until the
   * returned object's <code>request.end()</code> function is called.
   *
   * @param {String} path The server path to construct the call with. This is
   * appended to the base server path  (<code>this._baseURL.pathname</code>)
   * @param {Object|String} [data=null] The data to include with the request.
   * If this is an object, it is converted to URL-encoded parameters. If it's a
   * string it's used as is. If <code>null</code>, it is not included in the request.
   * @param {String} [method="POST"] The method to be used to send the request.
   * Valid methods include "POST" and "GET" ("PUT" may also work but it is not
   * currently recommended).
   * @param {Boolean} [useAuth=true] If true and authentication is available it
   * will be used, otherwise the request will be built without authentication
   * information.
   *
   * @return {Object} Contains the <code>request</code> and <code>response</code>
   * objects, the returned raw <code>data</code> string, and the <code>promise</code>
   * that resolves or rejects when the request has completed or failed. Note that
   * <code>response</code> and <code>data</code> will be <code>null</code> until
   * the promise resolves or rejects. Additional properties such as <code>session</code>
   * and <code>socket</code> may be included if [useHTTP2]{@link WPAPILib#useHTTP2} is
   * <code>true</code>.
   */
   buildRequest(path="", data=null, method="POST", useAuth=true) {
     var headers = this.addHeader("Content-Type", "application/x-www-form-urlencoded", headers);
     if (data == null) {
       this.addHeader("Content-Length", "0", headers);
     } else {
       if (typeof(data) == "object") {
         data = querystring.stringify(data);
       }
       this.addHeader("Content-Length", String(Buffer.byteLength(data)), headers);
     }
     this.addHeader("Accept", "application/json,text/javascript,text/html,application/xhtml+xml,application/xml, */*", headers);
     this.addHeader("Accept-Encoding", "identity", headers);
     this.addHeader("Accept-Language", "en-CA,en-US,en", headers);
     this.addHeader("User-Agent", this.userAgent, headers);
     if ((this.authenticated == true) && (useAuth == true)) {
       this.addHeader("Cookie", this.authHeader, headers);
       if (this.APINonce != null) {
         this.addHeader("X-WP-Nonce", this.APINonce, headers);
       }
     } else {
       this.addHeader("Cookie", "humans_21909=1", headers);
     }
     var fullPath = this._baseURL.pathname + "/" + path;
     fullPath = fullPath.split("//").join("/");
     if (this.useHTTP2 == true) {
        var returnObj = this.buildHTTP2Request(fullPath, method, data, headers);
     } else {
        returnObj = this.buildHTTP1Request(fullPath, method, data, headers);
     }
     return (returnObj);
   }

   /**
   * Builds a new HTTP/1.1 request / response object.
   *
   * @param {String} path The path portion of the URL (after the domain), to
   * send the request to.
   * @param {String} method The method to use to send the data. Can be either
   * "POST" or "GET" ("PUT" may also work but is not currentlu recommended).
   * @param {String} data The URL-encoded data string to include with the request.
   * If <code>null</code>, no data is sent with the request.
   * @param {Object} headers Name-value pairs of headers to send include with the
   * request. If included, the "Host" and "Connection" headers will be over-written
   *
   * @return {Object} Contains the HTTP <code>request</code> and proxy
   * <code>response</code> object (contains properties similar to a standard HTTP response),
   * the returned raw <code>data</code> string, and the <code>promise</code>
   * that resolves or rejects when the request has completed or failed. Note that
   * <code>response</code> and <code>data</code> will be <code>null</code> until
   * the promise resolves or rejects.
   */
   buildHTTP1Request(path, method, data, headers) {
     this.addHeader("Host", this._baseURL.hostname, headers);
     this.addHeader("Connection","keep-alive", headers);
     var options = {
       hostname: this._baseURL.hostname,
       port: this._baseURL.port,
       path: path,
       method: method,
       headers: headers
     }
     var returnObj = new Object();
     returnObj.request = null;
     returnObj.response = null;
     returnObj.data = null;
     returnObj.promise = new Promise((resolve, reject) => {
       switch (this._baseURL.protocol) {
          case "http:":
            returnObj.request = http.request(options, response => {
              var chunkedData = new String();
              response.on("data", chunk => {
                 chunkedData += chunk.toString();
               });
               response.on("end", _ => {
                 returnObj.response = response;
                 returnObj.data = chunkedData;
                 resolve(returnObj);
              });
            });
            break;
          case "https:":
            returnObj.request = https.request(options, response => {
              var chunkedData = new String();
              response.on("data", chunk => {
                 chunkedData += chunk.toString();
               })
               response.on("end", _ => {
                 returnObj.response = response;
                 returnObj.data = chunkedData;
                 resolve(returnObj);
              })
            })
            break;
          default:
            reject (new Error(`Unsupported protocol ${this._baseURL.protocol}`));
            break;
          }
       });
       if (data != null) {
         returnObj.request.write(data);
       }
       returnObj.request.on("error", error => {
         reject(new Error(error));
       })
       return (returnObj);
   }

   /**
   * Builds a new HTTP/2 request / response object.
   *
   * @param {String} path The path portion of the URL (after the domain), to
   * send the request to.
   * @param {String} method The method to use to send the data. Can be either
   * "POST" or "GET" ("PUT" may also work but is not currentlu recommended).
   * @param {String} data The URL-encoded data string to include with the request.
   * If <code>null</code>, no data is sent with the request.
   * @param {Object} headers Name-value pairs of headers to send include with the
   * request. Note that any reserved headers such as "path" or "method" will cause
   * an exception to be thrown.
   *
   * @return {Object} Contains the HTTP <code>request</code> and proxy
   * <code>response</code> object (contains properties similar to a standard HTTP response),
   * the returned raw <code>data</code> string, and the <code>promise</code>
   * that resolves or rejects when the request has completed or failed. Note that
   * <code>response</code> and <code>data</code> will be <code>null</code> until
   * the promise resolves or rejects. Additional HTTP/2 request properties may be included.
   */
   buildHTTP2Request(path, method, data, headers) {
     this.addHeader(":path", path, headers);
     this.addHeader(":method", method, headers);
     var returnObj = new Object();
     returnObj.request = null;
     returnObj.response = null;
     returnObj.data = null;
     returnObj.promise = new Promise((resolve, reject) => {
       if ((this._baseURL.protocol != "http:") && (this._baseURL.protocol != "https:")) {
         reject (new Error(`Unsupported protocol ${this._baseURL.protocol}`));
       }
       returnObj.client = http2.connect(this._baseURL.protocol + "//" + this._baseURL.hostname, {}, (h2Session, h2Socket) => {
         //HTTP/2 connection established
         returnObj.session = h2Session;
         returnObj.socket = h2Socket;
       });
       returnObj.request = returnObj.client.request(headers);
       returnObj.request.on("response", (headers, flags) => {
          var chunkedData = new String();
          returnObj.response = new Object();
          returnObj.response.headers = headers;
          var statusDesc = Object.getOwnPropertyDescriptor(headers, ":status");
          returnObj.response.statusCode = statusDesc.value;
          returnObj.request.on("data", chunk => {
             chunkedData += chunk.toString();
           });
           returnObj.request.on("end", _ => {
             returnObj.data = chunkedData;
             resolve(returnObj);
          });
       });
       if (data != null) {
         returnObj.request.write(data);
       }
       returnObj.request.on("error", error => {
         reject(new Error(error));
       })
     });
     return (returnObj);
   }

   /**
   * Adds a header name-value pair to a new or existing header object.
   *
   * @param {String} name The header name to add.
   * @param {String|Number} value The associated header value to add.
   * @param {Object} [headerObj=null] An existing header object to
   * add the name-value pair to. If omitted, a new object is created
   * before the pair is added.
   *
   * @return {Object}
   */
   addHeader(name, value, headerObj=null) {
     if (headerObj == null) {
       headerObj = new Object();
     }
     Object.defineProperty(headerObj, name, {
       value:value,
       writeable:true,
       enumerable:true,
       configurable:true
     })
     return (headerObj);
   }

   /**
   * @private
   */
   toString() {
     return (`WPAPILib ${this.version}`);
   }
}
