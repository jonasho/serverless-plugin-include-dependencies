 'use strict';

const _ = require('lodash');
const path = require('path');
const dependencies = require('dependency-tree');

module.exports = class IncludeDependencies {

  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = {
      'before:deploy:function:deploy': () => this.package(),
      'before:deploy:createDeploymentArtifacts': () => this.package()
    };
  }

  package() {
    const service = this.serverless.service;

    if (typeof service.functions === 'object') {
      const servicePath = this.serverless.config.servicePath;
      const cache = {};

      service.package = service.package || {};

      Object.keys(service.functions).forEach(functionName => {
        const functionObject = service.functions[functionName];
        const list = dependencies.toList({
          filename: this.getHandlerFilename(functionObject.handler),
          directory: servicePath,
          visited: cache,
          filter: path => path.indexOf('aws-sdk') === -1,
        });
        if (service.package && service.package.individually) {
          functionObject.package = functionObject.package || {};
          this.include(functionObject.package, list);
        } else {
          service.package = service.package || {};
          this.include(service.package, list);
        }
      });
    }
  }

  getHandlerFilename(handler) {
    const handlerPath = handler.slice(0, handler.lastIndexOf('.'));
    return require.resolve((path.join(this.serverless.config.servicePath, handlerPath)));
  }

  include(target, paths) {
    const servicePath = this.serverless.config.servicePath;
    const modules = {};

    paths.forEach(p => {
      const relativePath = path.relative(servicePath, p);

      if (relativePath.match(/^node_modules[/\\]/)) {
        const modulePath = this.getModulePath(relativePath.replace(/^node_modules[/\\]/, ''));
        const glob = path.join('node_modules', modulePath, '**');
        modules[`!${glob}`] = true;
      }
    });

    target.exclude = _.union(target.exclude, Object.keys(modules));
  }

  getModulePath(relativePath) {
    // this is a shitty attempt at cross-platform (i.e. Windows) path support
    return relativePath.split(/[/\\]/)[0];
  }

};
