const fs = require("fs");
const pify = require("pify");
const cp = require("child_process");
const chalk = require("chalk");

function runUpdate() {
  pify(fs.readFile)("package.json", "utf8")
    .then(data => {
      const package = JSON.parse(data);
      const dependencies = package.dependencies;
      const devDependencies = package.devDependencies;

      const depMap = [];

      if (dependencies) {
        for (const dependency in dependencies) {
          if (dependencies.hasOwnProperty(dependency)) {
            depMap.push(dependency);
          }
        }
      }

      if (devDependencies) {
        for (const dependency in devDependencies) {
          if (devDependencies.hasOwnProperty(dependency)) {
            depMap.push(dependency);
          }
        }
      }

      depMap.forEach((dependency, index) => {
        console.log(
          chalk`{blue {bold [${index +
            1}/${depMap.length}]} Updating Dependency \`{underline.bold ${dependency}}\`}`
        );
        try {
          cp.execSync("git stash");
          cp.execSync("git checkout master");
          cp.execSync(`git checkout -b update-brancher/update_${dependency}`);
          cp.execSync(`yarn upgrade ${dependency}`);
          cp.execSync("git add -A");
          cp.execSync(`git commit -m "Update ${dependency}"`);
          cp.execSync("git checkout master");
          console.log(
            chalk`{green {bold [${index +
              1}/${depMap.length}]} Updated Dependency \`{underline.bold ${dependency}}\` in branch \`{underline.bold update-brancher/update_${dependency}}\`}`
          );
        } catch (err) {
          cp.execSync("git reset --hard master");
          cp.execSync("git checkout master");
          console.log(
            chalk`{red {bold [${index +
              1}/${depMap.length}]} Failed to Update Dependency \`{underline.bold ${dependency}}\`}`
          );
        }
      });

      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

pify(fs.access)("package.json", fs.constants.R_OK | fs.constants.W_OK)
  .then(() => {
    pify(fs.access)(".git", fs.constants.R_OK | fs.constants.W_OK)
      .then(() => {
        runUpdate();
      })
      .catch(err => {
        console.error("Cannot access git repository.");
        console.error(err);
        process.exit(1);
      });
  })
  .catch(err => {
    console.error("Cannot access package.json");
    console.error(err);
    process.exit(1);
  });
