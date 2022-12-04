# vacuum-packer

Plugin helper for [makeshift-ctrl](https://github.com/EosFoundry/makeshift-ctrl), it does four things and four things only:

1. Builds the package into a single file using [rollup](https://rollupjs.org/guide/en/)
2. Hashes the file and shoves it into manifest.json
3. Extracts function names from the entry point and dumps it into a manifest.json
4. Zips everything up (UNDER CONSTRUCTION)

## Installation

It's recommended to install as a devDependency:

```sh
npm install --save-dev @eos-makeshift/vacuum-packer
```

Or a global executable:

```sh
npm install --global @eos-makeshift/vacuum-packer
```

## Usage

Run through `npx` or `npm exec` if not installed globally

```sh
npx vacuum-packer
```

## Using a Custom Configuration

vacuum-packer does some string-replacement on a default configuration file and saves it to your project root as `rollup.config.js`, and it will always use the generated file afterwards. If your plugin requires something more specific, you should edit the generated `rollup.config.js` to accomodate - see [rollup documentation](https://www.rollupjs.org/guide/en/) for specifics on how to do so.

## Known Issues

rollup is known to not play well with platform-specific code, join the [discord server](https://discord.gg/hPw4j3vfCT) if you would like to discuss this issue


TODO: fix example copy-pasta