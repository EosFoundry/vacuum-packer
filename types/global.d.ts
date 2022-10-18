export type Manifest = {
    name: string,
    version: string,
    functions: PluginCallable[]
}

export type PluginCallable = {
    identifier: string,
    params: [{
        name: string,
        type?: string,
    }],
    docString?: string,
    async: boolean,
    generate: boolean,
}