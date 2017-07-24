const fs = require("fs");
const pify = require("pify");
const execa = require("execa");
const Listr = require("listr");

const dependencyTask = dependency => ({
  title: `\`${dependency}\``,
  task: () =>
    new Listr(
      [
        {
          title: "Checking Git Status",
          task: () =>
            execa
              .stdout("git", ["status", "--porcelain"])
              .then(result => {
                if (result !== "") {
                  throw new Error(
                    "Unclean working tree. Commit or stash changes first."
                  );
                }
              })
              .catch(err => {
                throw err;
              })
        },
        {
          title: "Checking Out `master` Branch",
          task: () => execa.stdout("git", ["checkout", "master"])
        },
        {
          title: `Checking Out \`update-brancher/update_${dependency}\` Branch`,
          task: () =>
            execa
              .stdout("git", [
                "checkout",
                "-b",
                `update-brancher/update_${dependency}`
              ])
              .catch(err => {
                throw err;
              })
        },
        {
          title: "Updating Package Using `yarn`",
          task: (ctx, task) =>
            execa.stdout("yarn", ["upgrade", dependency]).catch(() => {
              ctx.yarn = false;

              task.skip(
                "Yarn not available, install it via `npm install -g yarn`"
              );
            })
        },
        {
          title: "Updating Package Using `npm`",
          enabled: ctx => ctx.yarn === false,
          task: () =>
            execa.stdout("npm", ["update", dependency]).catch(err => {
              execa.stdout("git", ["reset", "--hard", "master"]);
              execa.stdout("git", ["checkout", "master"]);
              throw new Error(`Unable to Upgrade Dependency \`${dependency}\``);
            })
        },
        {
          title: "Staging Changed Files",
          task: () =>
            execa.stdout("git", ["add", "-A"]).catch(err => {
              execa.stdout("git", ["reset", "--hard", "master"]);
              execa.stdout("git", ["checkout", "master"]);
              throw new Error(`Unable to Upgrade Dependency \`${dependency}\``);
            })
        },
        {
          title: "Committing Changed Files",
          task: () =>
            execa
              .stdout("git", ["commit", "-m", `"Update ${dependency}"`])
              .catch(err => {
                execa.stdout("git", ["reset", "--hard", "master"]);
                throw err;
              })
        },
        {
          title: "Checking Out `master` Branch",
          task: () => execa.stdout("git", ["checkout", "master"])
        }
      ],
      { exitOnError: false }
    )
});

function runUpdate() {
  pify(fs.readFile)("package.json", "utf8")
    .then(data => {
      const package = JSON.parse(data);
      const dependencies = package.dependencies;
      const devDependencies = package.devDependencies;

      const tasks = new Listr([], { exitOnError: false });

      if (dependencies) {
        tasks.add({
          title: "Updating Dependencies",
          task: () => {
            const depTasks = new Listr([]);

            for (const dependency in dependencies) {
              if (dependencies.hasOwnProperty(dependency)) {
                depTasks.add(dependencyTask(dependency));
              }
            }

            return depTasks;
          }
        });
      }

      if (devDependencies) {
        tasks.add({
          title: "Updating Development Dependencies",
          task: () => {
            const depTasks = new Listr([]);

            for (const dependency in devDependencies) {
              if (devDependencies.hasOwnProperty(dependency)) {
                depTasks.add(dependencyTask(dependency));
              }
            }

            return depTasks;
          }
        });
      }

      tasks.run().catch(err => {
        console.error(err);
        process.exit(1);
      });
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

const tasks = new Listr(
  [
    {
      title: "Checking for `package.json`",
      task: () =>
        pify(fs.access)("package.json", fs.constants.R_OK | fs.constants.W_OK)
    },
    {
      title: "Checking for `.git`",
      task: () => pify(fs.access)(".git", fs.constants.R_OK | fs.constants.W_OK)
    }
  ],
  { concurrent: true, clearOutput: true }
);

tasks
  .run()
  .then(() => {
    runUpdate();
  })
  .catch(err => {
    process.exit(1);
  });
