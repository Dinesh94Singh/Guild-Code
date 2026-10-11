Each theme pack's page side: one `<season>.js` that sets `GuildPacks.<season> = api => ({ ...hooks })`.
`demo/build.mjs` inlines every `.js` here into the Guild Hall page. The hooks are listed at the
seasons section of `demo/src.html`.
