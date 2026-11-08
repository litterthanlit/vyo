import json
d=json.load(open('../hypher-facts.json'))
R=[("Hypher/","mac app"),("extensions/chrome","browser add-on"),("extensions/cursor","cursor helpers"),
("hypher-web/convex","server"),("hypher-web/shared","handoff note"),
("hypher-web/src/app/api","web requests"),("hypher-web/src/app/oauth","sign-in"),
("hypher-web/src/app","settings pages"),("hypher-web/src/components/marketing","marketing site"),
("hypher-web/src/components","screens"),("hypher-web/src/lib","web helpers"),("hypher-web/src/types","web helpers"),
("hypher-web/tools","web helpers"),("packages/core","core"),("packages/hypher-cli","command line"),("script","scripts")]
order=["mac app","browser add-on","cursor helpers","server","handoff note","web requests","settings pages","sign-in","screens","marketing site","web helpers","core","command line","scripts"]
S={n:{"name":n,"loc":0,"files":0} for n in order}; miss={}
for p,f in d['files'].items():
    for pre,n in R:
        if p.startswith(pre): S[n]['loc']+=f['loc'];S[n]['files']+=1;break
    else: miss[p.split('/')[0]]=miss.get(p.split('/')[0],0)+f['loc']
print(miss)
json.dump([S[n] for n in order],open('parts.json','w'),indent=1)
for n in order:print(S[n])
