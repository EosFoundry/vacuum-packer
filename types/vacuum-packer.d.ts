type Manifest = {
    name: string,
    version: string,
    functions: PluginCallable[]
}

type PluginCallable = {
    identifier: string,
    params: [{
        name: string,
        type?: string,
    }],
    docString?: string,
    async: boolean,
    generate: boolean,
}