#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const ReadLine = require('readline');
const { promisify } = require('util');
const { exec } = require('child_process');

let projectName = process.argv[2];
let projectId;
let author;
let authorEmail;
let authorWebsite;
let description;
let version = '1.0.0';

(async () => {
  if (!projectName) {
    const readLine = ReadLine.createInterface({ input: process.stdin, output: process.stdout });
    const question = promisify(readLine.question).bind(readLine);
    projectName = await question('name (required): ');
    projectId = await question('app id (e.g. com.example.app): ');
    author = await question('author: ');
    authorEmail = await question('author email: ');
    authorWebsite = await question('author website: ');
    description = await question('description: ');
    version = await question('version: ');
    readLine.close();

    if (!projectName) {
      console.log('project name is required');
      process.exit(1);
    }
  }

  const projectLegalName = projectName.replace(/\s/g, '').toLowerCase();
  const projectPath = path.join(process.cwd(), projectLegalName);
  const domain = authorWebsite?.split('.').reverse().join('.') || "com.example.";

  projectId = projectId ?? (domain + projectLegalName);

  console.log('Loading template...');
  exec(`git clone https://github.com/foxdebug/cordova.git "${projectPath}"`, (err, stdout, stderr) => {
    if (err) {
      console.log(err);
      process.exit(1);
    } else {
      console.log('Template loaded.');
      const dotGitPath = path.join(projectPath, '.git');
      const packageJson = require(path.join(projectPath, 'package.json'));

      fs.rmSync(dotGitPath, { recursive: true });

      // Update package.json
      packageJson.name = projectLegalName;
      packageJson.displayName = projectName;
      packageJson.version = '0.0.1';
      if (description) packageJson.description = description;
      if (author) packageJson.author = `${author} ${authorEmail ? `<${authorEmail}>` : ''} ${authorWebsite ? `(${authorWebsite})` : ''}`;
      fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Update config.xml
      const configXmlPath = path.join(projectPath, 'config.xml');
      const configXml = fs.readFileSync(configXmlPath, 'utf8');
      let newConfigXml = configXml.replaceAll('io.cordova.hellocordova', projectId);
      newConfigXml = newConfigXml.replaceAll('HelloCordova', projectName);
      newConfigXml = newConfigXml.replaceAll('0.0.1', version);
      if (author) newConfigXml = newConfigXml.replace('Apache Cordova Team', author);
      if (description) newConfigXml = newConfigXml.replace('A sample Apache Cordova application that responds to the deviceready event.', description);
      if (authorEmail) newConfigXml = newConfigXml.replaceAll('dev@cordova.apache.org', authorEmail);
      if (authorWebsite) newConfigXml = newConfigXml.replace('http://cordova.io', authorWebsite);
      fs.writeFileSync(configXmlPath, newConfigXml);

      // Update native/plugin.xml
      const pluginXmlPath = path.join(projectPath, 'native', 'plugin.xml');
      const pluginXml = fs.readFileSync(pluginXmlPath, 'utf8');
      let newPluginXml = pluginXml.replaceAll('io/cordova/hellocordova', projectId.replace(/\./g, '/'));
      newPluginXml = newPluginXml.replaceAll('io.cordova.hellocordova', projectId);
      fs.writeFileSync(pluginXmlPath, newPluginXml);

      // move java file to new package
      const filename = 'Native.java';
      const filepath = 'native/android/io/cordova/hellocordova/';
      const content = fs.readFileSync(path.join(projectPath, filepath, filename), 'utf8');
      const newContent = content.replaceAll('io.cordova.hellocordova', projectId);
      // remove old package
      fs.rmSync(path.join(projectPath, 'native/android/io'), { recursive: true });
      // create new package
      const newFilepath = path.join(projectPath, 'native/android/', projectId.replace(/\./g, '/'));
      fs.mkdirSync(newFilepath, { recursive: true });
      // write new file
      fs.writeFileSync(path.join(newFilepath, filename), newContent);
    }
  });

})();