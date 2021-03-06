(function() {
  var CommandHandler, Context, Keyboard, _, _s, co, constants, ejs, emoji, promise, resolveYield,
    slice = [].slice;

  Context = require('./context');

  constants = require('./constants');

  promise = require('bluebird');

  _s = require('underscore.string');

  _ = require('lodash');

  emoji = require('node-emoji');

  ejs = require('ejs');

  co = require('co');

  Keyboard = require('./keyboard');

  resolveYield = function(value) {
    if (value && (value.then || _.isObject(value) && value.toString() === '[object Generator]' || _.isFunction(value))) {
      return value;
    } else {
      return Promise.resolve(value);
    }
  };


  /*
  CommandHandler class
  Creates for each incoming request.
   */

  CommandHandler = (function() {

    /*
    @param {Object} params the command handler params
     */
    function CommandHandler(params) {
      var base, base1, base2, base3, base4, base5, base6, ref, ref1, ref2, ref3;
      this.name = params.name;
      this.message = params.message;
      this.inlineQuery = params.inlineQuery;
      this.chosenInlineResult = params.chosenInlineResult;
      this.callbackQuery = params.callbackQuery;
      this.callbackData = params.callbackData;
      this.bot = params.bot;
      this.locale = (ref = params.prevHandler) != null ? ref.locale : void 0;
      this.session = params.session || {};
      this.type = params.type;
      this.isRedirected = !!params.prevHandler;
      (base = this.session).meta || (base.meta = {});
      (base1 = this.session.meta).user || (base1.user = (ref1 = this.message) != null ? ref1.from : void 0);
      (base2 = this.session.meta).chat || (base2.chat = (ref2 = this.message) != null ? ref2.chat : void 0);
      (base3 = this.session.meta).sessionId || (base3.sessionId = this.provideSessionId());
      (base4 = this.session).data || (base4.data = {});
      (base5 = this.session).backHistory || (base5.backHistory = {});
      (base6 = this.session).backHistoryArgs || (base6.backHistoryArgs = {});
      this.prevHandler = params.prevHandler;
      this.noChangeHistory = params.noChangeHistory;
      this.args = params.args;
      this.chain = [this.bot];
      this.middlewaresChains = this.bot.getMiddlewaresChains([]);
      this.isSynthetic = params.isSynthetic;
      this.command = null;
      if (this.isSynthetic) {
        this.type = 'synthetic';
      }
      this.context = ((ref3 = this.prevHandler) != null ? ref3.context.clone(this) : void 0) || new Context(this);
    }


    /*
    @param {String} locale current locale
     */

    CommandHandler.prototype.setLocale = function(locale) {
      var ref;
      this.locale = locale;
      return (ref = this.prevHandler) != null ? ref.setLocale(this.locale) : void 0;
    };


    /*
    @return {String} current locale
     */

    CommandHandler.prototype.getLocale = function() {
      return this.locale;
    };


    /*
    @return {String} sessionId
     */

    CommandHandler.prototype.provideSessionId = function() {
      return this.session.meta.chat.id;
    };


    /*
    Start handling message
    @return {Promise}
     */

    CommandHandler.prototype.handle = function() {
      var _args, _callbackData, _name, _value, params, ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, ref8, text;
      if (!this.type && this.message && !this.prevHandler) {
        if ((ref = this.message) != null ? ref.text : void 0) {
          text = this.message.text = _s.trim(this.message.text);
          if (text.indexOf('/') === 0) {
            this.type = 'invoke';
            params = text.slice(1).split(/\s+|__/);
            this.name = params[0].toLowerCase().replace(/@.+$/, '');
          } else {
            this.type = 'answer';
            this.name = (ref1 = this.session.meta) != null ? ref1.current : void 0;
          }
          if (this.type === 'answer' && !this.name) {
            this.name = 'start';
            this.type = 'invoke';
            this.args = [];
          }
        } else if (!this.isSynthetic) {
          this.type = 'answer';
          this.name = (ref2 = this.session.meta) != null ? ref2.current : void 0;
        }
      }
      if (!this.type && this.callbackQuery) {
        this.type = 'callback';
      }
      this.commandsChain = this.bot.getCommandsChain(this.name);
      if (_.isString((ref3 = this.commandsChain[0]) != null ? ref3.name : void 0)) {
        this.command = this.commandsChain[0];
      }
      this.chain = this.bot.getCommandsChain(this.name, {
        includeBot: true
      });
      if (this.commandsChain.length) {
        if (this.type === 'invoke') {
          this.args || (this.args = (params != null ? params.slice(1) : void 0) || []);
        }
      } else if (!this.isSynthetic && this.type === 'answer') {
        this.type = 'invoke';
        this.name = (ref4 = this.bot.getDefaultCommand()) != null ? ref4.name : void 0;
        this.commandsChain = this.bot.getCommandsChain(this.name);
      }
      if (!this.name && !this.isSynthetic && this.type !== 'callback') {
        return;
      }
      if (this.type === 'answer') {
        this.original = this.message;
        this.args = this.session.invokeArgs;
        if (!_.isEmpty(this.session.keyboardMap)) {
          this.answer = this.session.keyboardMap[this.message.text];
          if (this.answer == null) {
            if (((ref5 = this.command) != null ? ref5.compliantKeyboard : void 0) || _.values(this.session.keyboardMap).some(function(button) {
              return button.requestContact || button.requestContact;
            })) {
              this.answer = {
                value: this.message.text
              };
            } else {
              return;
            }
          } else if (this.answer.go) {
            this.goHandler = (function() {
              switch (this.answer.go) {
                case '$back':
                  return function(ctx) {
                    return ctx.goBack();
                  };
                case '$parent':
                  return function(ctx) {
                    return ctx.goParent();
                  };
                default:
                  return (function(_this) {
                    return function(ctx) {
                      return ctx.go(_this.answer.go, {
                        args: _this.answer.args
                      });
                    };
                  })(this);
              }
            }).call(this);
          } else if (this.answer.handler) {
            this.goHandler = eval("(" + this.answer.handler + ")");
          }
        } else {
          this.answer = {
            value: this.message.text
          };
        }
      }
      if (this.type === 'invoke') {
        this.session.invokeArgs = this.args;
        if (!this.noChangeHistory && ((ref6 = this.prevHandler) != null ? ref6.name : void 0) && this.prevHandler.name !== this.name) {
          this.session.backHistory[this.name] = this.prevHandler.name;
          this.session.backHistoryArgs[this.name] = this.prevHandler.args;
        }
        this.session.meta.current = this.name;
        _.extend(this.session.meta, _.pick(this.message, 'from', 'chat'));
        this.session.meta.user = ((ref7 = this.message) != null ? ref7.from : void 0) || this.session.meta.user;
      }
      if (this.type === 'callback' && !this.prevHandler) {
        ref8 = this.callbackQuery.data.split('|'), _name = ref8[0], _args = ref8[1], _value = ref8[2], _callbackData = 4 <= ref8.length ? slice.call(ref8, 3) : [];
        _callbackData = JSON.parse(_callbackData.join('|'));
        _args = _.compact(_args.split(','));
        this.callbackData = _callbackData;
        this.goHandler = function(ctx) {
          return ctx.go(_name, {
            args: _args,
            value: _value,
            callbackData: _callbackData,
            callbackQuery: this.callbackQuery
          });
        };
      }
      this.middlewaresChains = this.bot.getMiddlewaresChains(this.commandsChain);
      this.context.init();
      if (this.goHandler) {
        return this.executeMiddleware(this.goHandler);
      } else {
        return promise.resolve(_(constants.STAGES).sortBy('priority').reject('noExecute').filter((function(_this) {
          return function(stage) {
            return !stage.type || stage.type === _this.type;
          };
        })(this)).map('name').value()).each((function(_this) {
          return function(stage) {
            return _this.executeStage(stage);
          };
        })(this));
      }
    };


    /*
    @return {Array} full command chain
     */

    CommandHandler.prototype.getFullChain = function() {
      return [this.context].concat(this.chain);
    };


    /*
    Render text
    @param {String} key localization key
    @param {Object} data template data
    @param {Object} [options] options
    @return {String}
     */

    CommandHandler.prototype.renderText = function(key, data, options) {
      var chain, command, exData, i, len, locale, text, textFn;
      if (options == null) {
        options = {};
      }
      locale = this.getLocale();
      chain = this.getFullChain();
      for (i = 0, len = chain.length; i < len; i++) {
        command = chain[i];
        textFn = command.getText(key, locale) || command.getText(key);
        if (textFn) {
          break;
        }
      }
      exData = {
        render: (function(_this) {
          return function(key) {
            return _this.renderText(key, data, options);
          };
        })(this)
      };
      data = _.extend({}, exData, data);
      text = typeof textFn === 'function' ? textFn(data) : !options.strict ? ejs.compile(key)(data) : void 0;
      return text;
    };


    /*
    @param {String} stage
    @return {Promise}
     */

    CommandHandler.prototype.executeStage = co.wrap(function*(stage) {
      var i, len, middleware, ref, results;
      ref = this.middlewaresChains[stage] || [];
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        middleware = ref[i];
        results.push((yield resolveYield(this.executeMiddleware(middleware))));
      }
      return results;
    });


    /*
    @param {Function} middleware
    @return {Promise}
     */

    CommandHandler.prototype.executeMiddleware = co.wrap(function*(middleware) {
      if (!this.context.isEnded) {
        return (yield resolveYield(middleware(this.context)));
      }
    });


    /*
    Go to command
    
    @param {String} name command name
    @param {Object} params params
    @option params {Array<String>} [args] Arguments for command
    @option params {Boolean} [noChangeHistory] No change chain history
     */

    CommandHandler.prototype.go = function(name, params) {
      var handler, message, ref, type;
      if (params == null) {
        params = {};
      }
      message = _.extend({}, this.message);
      ref = name.split('$'), name = ref[0], type = ref[1];
      if (type === 'cb') {
        type = 'callback';
      }
      handler = new CommandHandler({
        name: name,
        message: message,
        bot: this.bot,
        session: this.session,
        prevHandler: this,
        noChangeHistory: params.noChangeHistory,
        args: params.args,
        callbackData: params.callbackData || this.callbackData,
        type: params.type || type || 'invoke'
      });
      return handler.handle();
    };


    /*
    @return {String} Previous state name
     */

    CommandHandler.prototype.getPrevStateName = function() {
      return this.session.backHistory[this.name];
    };

    CommandHandler.prototype.getPrevStateArgs = function() {
      var ref;
      return (ref = this.session.backHistoryArgs) != null ? ref[this.name] : void 0;
    };


    /*
    Render keyboard
    @param {String} name custom keyboard name
    @return {Object} keyboard array of keyboard
     */

    CommandHandler.prototype.renderKeyboard = function(name, params) {
      var chain, command, data, i, isInline, keyboard, len, locale, map, markup;
      if (params == null) {
        params = {};
      }
      locale = this.getLocale();
      chain = this.getFullChain();
      data = this.context.data;
      isInline = params.inline;
      keyboard = null;
      for (i = 0, len = chain.length; i < len; i++) {
        command = chain[i];
        if (command.prevKeyboard && !isInline) {
          return {
            prevKeyboard: true
          };
        }
        keyboard = params.keyboard && new Keyboard(params.keyboard, params) || command.getKeyboard(name, locale, params) || command.getKeyboard(name, null, params);
        if (typeof keyboard !== 'undefined') {
          break;
        }
      }
      keyboard = keyboard != null ? keyboard.render(locale, chain, data, this) : void 0;
      if (keyboard) {
        markup = keyboard.markup, map = keyboard.map;
        if (!isInline) {
          this.session.keyboardMap = map;
          this.session.meta.current = this.name;
        }
        return markup;
      } else {
        if (!isInline) {
          this.session.keyboardMap = {};
          this.session.meta.current = this.name;
        }
        return null;
      }
    };

    CommandHandler.prototype.unsetKeyboardMap = function() {
      return this.session.keyboardMap = {};
    };

    CommandHandler.prototype.resetBackHistory = function() {
      var currentBackName;
      if (!this.noChangeHistory) {
        currentBackName = this.session.backHistory[this.name];
        this.session.backHistory[this.name] = this.session.backHistory[currentBackName];
        return this.session.backHistoryArgs[this.name] = this.session.backHistoryArgs[currentBackName];
      }
    };

    return CommandHandler;

  })();

  module.exports = CommandHandler;

}).call(this);
