const sqlite3 = require("sqlite3").verbose()
const path = require("path")
const JSSoup = require("jssoup").default
const axios = require("axios")
const fs = require("fs")
const inquirer = require("inquirer")
const figlet = require("figlet")
const chalk = require("chalk")
const passive_skill = require("./passiveSkill")
let nodb = false
const path1 = path.join(__dirname, "whitelist.json")
if (!fs.existsSync(path1)){
    fs.appendFileSync("./whitelist.json",`{\n    "whitelist":[\n\n    ],\n    "banned":[\n\n    ],\n    "whitelistEZA":[\n\n    ],\n    "bannedEZA":[\n\n    ]\n}`)
}
const db_jap = new sqlite3.Database(path.resolve('./databases/db_jap.db'),sqlite3.OPEN_READONLY,(err)=>{
})

const db_glo = new sqlite3.Database(path.resolve('./databases/db_glo.db'),sqlite3.OPEN_READONLY,(err)=>{ 
})


async function query(query,db){
    return new Promise(function(resolve,reject){
        db.all(query, function(err,rows){
           if(err){return reject(err);}
           resolve(rows);
         });
    });
}

async function includeEffect_Pack(){
    let folders = []
    console.log(chalk.blue.bold("Génération de la table effect_packs..."))
    let effect_pack_glo = await query(`SELECT * FROM effect_packs`,db_glo)
    let effect_pack_jap = await query(`SELECT * FROM effect_packs`,db_jap)
    let difference = []
    fs.writeFileSync('./misc.sql', '');
    for (let index = 0; index < effect_pack_jap.length; index++) {
        const element = effect_pack_jap[index];

        if (effect_pack_glo.find(e => e.id === element.id)) continue;
        else difference.push(element)
        
    }

    for (let index = 0; index < difference.length; index++) {
        const element = difference[index]
        fs.appendFileSync('./misc.sql', `INSERT OR REPLACE INTO effect_packs(id,category,name,pack_name,scene_name,red,green,blue,alpha,lite_flicker_rate,created_at,updated_at) VALUES(${element.id},${element.category},'${element.name}','${element.pack_name}','${element.scene_name}',${element.red},${element.green},${element.blue},${element.alpha},${element.lite_flicker_rate},'${element.created_at}','${element.updated_at}');\n`);
        if (!folders.includes(element.pack_name)){
            folders.push(element.pack_name)
        }
    }
    fs.appendFileSync('./misc.sql', `\n\n\n`);
    for (let index = 0; index < folders.length; index++) {
        const element = folders[index];
        fs.appendFileSync('./misc.sql', `-- ${element}\n`);

    }
    await getCausalities()
    return console.log(chalk.greenBright.bold("Génération terminée !"))

}
async function getCausalities() {
    let effect_pack_glo = await query(`SELECT * FROM card_awakening_sets`,db_glo)
    let effect_pack_jap = await query(`SELECT * FROM card_awakening_sets`,db_jap)
    let difference = []

    for (let index = 0; index < effect_pack_jap.length; index++) {
        const element = effect_pack_jap[index];

        if (effect_pack_glo.find(e => e.id === element.id)) continue;
        else difference.push(element)
        
    }

    for (let index = 0; index < difference.length; index++) {
        const element = difference[index]
        fs.appendFileSync('./misc.sql', `INSERT OR REPLACE INTO card_awakening_sets(id,name,description,created_at,updated_at) VALUES(${element.id},'${element.name}','${element.description}','${element.created_at}','${element.updated_at}');\n`);
    }
    return null

}

async function tradAll(whitelist){
    async function getExclus(){
        let cards_jap = await query("SELECT * FROM cards",db_jap)
        let cards_glo = await query("SELECT * FROM cards",db_glo)
        let exclusjap = []
        for (let index = 0; index < cards_jap.length; index++) {
        const card = cards_jap[index];
        if (cards_glo.find(e => e.id === card.id)) continue;
        const firstDigitStr = String(card.id)[0];
        const firstDigitNum = Number(firstDigitStr);
    
        if (firstDigitNum !== 1 && firstDigitNum !==4) continue;
        
        exclusjap.push(card)
        }
        return exclusjap
    }
    let exclusjap = await getExclus()
    function decodeHTMLEntities(text) {
        var entities = [
            ['amp', '&'],
            ['apos', '\''],
            ['#x27', '\''],
            ['#x2F', '/'],
            ['#39', '\''],
            ['#47', '/'],
            ['lt', '<'],
            ['gt', '>'],
            ['nbsp', ' '],
            ['quot', '"'],
            ['#039',"'"]
        ];
        for (var i = 0, max = entities.length; i < max; ++i) 
            text = text.replace(new RegExp('&'+entities[i][0]+';', 'g'), entities[i][1]);
    
        return text;
    }
    let appliedPassives = []
    let appliedLeaders = []
    let appliedSAs = []
    let appliedChara = []
    let applieduniqInfos = []
    let applied = []
    let appliedAS = []
    async function scrapData(card){
        let cardinfos = await axios.get(`https://dokkaninfo.com/cards/${card.id}`).catch(e => {})
        try {
            cardinfos = cardinfos.data
        } catch (error) {
            cardinfos = false
        }
        if (!cardinfos){

        } else {
            var soup = new JSSoup(cardinfos);
        var test = soup.findAll('div')
        let passif = decodeHTMLEntities(test.find(a => a.attrs.id === "card_passive_skill_description").nextElement.contents[0]._text)
        let leader_shit = test.find(a => a.attrs.id === "card_leader_skill").nextElement.contents[0]
        let cardName = decodeHTMLEntities(test.find(a => a.attrs.id === "card_name").nextElement.contents[0]._text)
        let leader_name = test.find(a => a.attrs.id === "card_name").previousElement.previousElement.previousElement.contents[0]._text
        let passiveName = decodeHTMLEntities(test.find(a => a.attrs.id === "card_passive_skill_name").nextElement.contents[0]._text).replace(/\n/g, '')
        let leaderskill = ""
        let isLeader_finished = false
        let transfo_shit = test.find(a => a.attrs.id === "card_transformation").nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement._text
        while (!isLeader_finished) {
            if (typeof leader_shit._text === "undefined" && typeof leader_shit.nextElement._text === "undefined"){
                isLeader_finished = true
            } else {
                
                if (typeof leader_shit._text === "undefined") {
                    leader_shit = leader_shit.nextElement 
                } else {
                    leaderskill = leaderskill + leader_shit._text
                    leader_shit = leader_shit.nextElement
                }
                
             }
        }
        leaderskill = decodeHTMLEntities(leaderskill)
        let SAs = []
        let Ultimate_SAs = []
        for (let index = 0; index < test.length; index++) {
            const element = test[index];
            if (element.attrs.id === "CardSuperName12") {
                let condition = null
                if (element.previousElement._text.replace(/\n/g, '') === "Unit Super Attack"){
                    condition = decodeHTMLEntities(element.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement._text).replaceAll("'", "''")
                }
                SAs.push({
                    type: element.previousElement._text.replace(/\n/g, ''),
                    name: decodeHTMLEntities(element.nextElement.nextElement.nextElement._text.replace(/\n/g, '').replaceAll('(12KI)', '').replaceAll('(12 KI)', '').replaceAll('(9 KI)', '').replaceAll('(9KI)', '')).replaceAll("'", "''").replaceAll("\n", " \n"),
                    effect : decodeHTMLEntities(element.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement._text).replaceAll("'", "''").replaceAll("\n", " \n"),
                    condition : condition
                })
            }
        }
        let hasActive = await query(`SELECT * FROM card_active_skills WHERE card_id=${card.id}`,db_jap)
        if (hasActive.length > 0) {
            hasActive = true
        } else hasActive = false
        if (card.rarity === 5){
            for (let index = 0; index < test.length; index++) {
                const element = test[index];
            if (element.attrs.id === "CardSuperName18") {
                let condition = null
                if (element.previousElement._text.replace(/\n/g, '') === "Unit Ultra Super Attack"){
                    condition = decodeHTMLEntities(element.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement._text).replaceAll("'", "''").replaceAll("\n", " \n")
                }
                Ultimate_SAs.push({
                    type: element.previousElement._text.replace(/\n/g, ''),
                    name: decodeHTMLEntities(element.nextElement.nextElement.contents[0]._text.replace(/\n/g, '').replaceAll('(18KI)', '').replaceAll('(18 KI)', '')).replaceAll("'", "''").replaceAll("\n", " \n"),
                    effect : decodeHTMLEntities(element.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement._text).replaceAll("'", "''").replaceAll("\n", " \n"),
                    condition : condition
                })
            }
            }
            
        }
        let ActiveSkill_Name = null
        let ActiveSkill_Cond = null
        let ActiveSkill_Desc = null
        if (hasActive){
            let active_shit = test.find(a => a.attrs.id === "card_active_skill").nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement
            ActiveSkill_Name = active_shit._text
            active_shit = active_shit.nextElement.nextElement.nextElement.nextElement
            ActiveSkill_Desc = active_shit._text
            ActiveSkill_Cond = active_shit.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.nextElement.contents[0]._text
            ActiveSkill_Name = decodeHTMLEntities(ActiveSkill_Name).replaceAll("'", "''")
            ActiveSkill_Desc = decodeHTMLEntities(ActiveSkill_Desc).replaceAll("'", "''")
            ActiveSkill_Cond = decodeHTMLEntities(ActiveSkill_Cond).replaceAll("'", "''")
        }
        cardName = decodeHTMLEntities(cardName)
        leader_name = decodeHTMLEntities(leader_name)
        leaderskill = decodeHTMLEntities(leaderskill)
        passiveName = decodeHTMLEntities(passiveName)
        passif = decodeHTMLEntities(passif)

        if (hasActive){
            ActiveSkill_Cond = decodeHTMLEntities(ActiveSkill_Cond)
        ActiveSkill_Name = decodeHTMLEntities(ActiveSkill_Name)
        ActiveSkill_Desc = decodeHTMLEntities(ActiveSkill_Desc)
        }
        
        const first2 = leaderskill.slice(0, 1);
        if (first2.includes("\n")){
            leaderskill = leaderskill.slice(1);
        }
        passiveName = passiveName.replaceAll("'", "''")
        cardName = cardName.replaceAll("'", "''")
        leaderskill = leaderskill.replaceAll("'", "''").replaceAll("\n", " \n").slice(0,-2)
        leader_name = leader_name.replaceAll("'", "''")
        passif = passif.replaceAll("'", "''").replace("\n","").replaceAll("\n", " \n")
        passif = passif.slice(0,-1)
        return {
            nom: cardName,
            leader_nom: leader_name,
            leader_skill: leaderskill,
            passive_name: passiveName,
            passive_skill: passif,
            SAs: SAs,
            SAs_Ultime: Ultimate_SAs,
            AS_name: ActiveSkill_Name,
            AS_cond: ActiveSkill_Cond,
            AS_desc: ActiveSkill_Desc,
            Transfo_Cond: transfo_shit
        }
        }
        
    }
    async function implementCard(card){
        let param_no = []
        let translatedcard = await scrapData(card)
        let viewIDS = []
        const lastDigit1Str = String(card.id).slice(-1);
        const lastDigit1Num = Number(lastDigit1Str);
        fs.appendFileSync('./japan_port.sql', `INSERT OR REPLACE INTO cards(id,name,character_id,card_unique_info_id,cost,rarity,hp_init,hp_max,atk_init,atk_max,def_init,def_max,element,lv_max,skill_lv_max,grow_type,optimal_awakening_grow_type,price,exp_type,training_exp,special_motion,passive_skill_set_id,leader_skill_set_id,link_skill1_id,link_skill2_id,link_skill3_id,link_skill4_id,link_skill5_id,link_skill6_id,link_skill7_id,eball_mod_min,eball_mod_num100,eball_mod_mid,eball_mod_mid_num,eball_mod_max,eball_mod_max_num,max_level_reward_id,max_level_reward_type,collectable_type,face_x,face_y,aura_id,aura_scale,aura_offset_x,aura_offset_y,is_aura_front,is_selling_only,awakening_number,resource_id,bg_effect_id,selling_exchange_point,awakening_element_type,potential_board_id,open_at,created_at,updated_at) VALUES(${card.id},'${translatedcard.nom}',${card.character_id},${card.card_unique_info_id},${card.cost},${card.rarity},${card.hp_init},${card.hp_max},${card.atk_init},${card.atk_max},${card.def_init},${card.def_max},${card.element},${card.lv_max},${card.skill_lv_max},${card.grow_type},${card.optimal_awakening_grow_type},${card.price},${card.exp_type},${card.training_exp},${card.special_motion},${card.passive_skill_set_id},${card.leader_skill_set_id},${card.link_skill1_id},${card.link_skill2_id},${card.link_skill3_id},${card.link_skill4_id},${card.link_skill5_id},${card.link_skill6_id},${card.link_skill7_id},${card.eball_mod_min},${card.eball_mod_num100},${card.eball_mod_mid},${card.eball_mod_mid_num},${card.eball_mod_max},${card.eball_mod_max_num},${card.max_level_reward_id},${card.max_level_reward_type},${card.collectable_type},${card.face_x},${card.face_y},${card.aura_id},${card.aura_scale},${card.aura_offset_x},${card.aura_offset_y},${card.is_aura_front},${card.is_selling_only},${card.awakening_number},${card.resource_id},${card.bg_effect_id},${card.selling_exchange_point},${card.awakening_element_type},${card.potential_board_id},'${card.open_at}','${card.created_at}','${card.updated_at}');\n`);
        if (!appliedPassives.includes(card.passive_skill_set_id)){
            let passiveSQL = await passive_skill.importPassive(card,translatedcard.passive_name,translatedcard.passive_skill,translatedcard.Transfo_Cond)
            param_no = param_no.concat(passiveSQL.param_no)
            fs.appendFileSync('./japan_port.sql', passiveSQL.SQLCode);
            appliedPassives.push(card.passive_skill_set_id)
        }

        if (!appliedLeaders.includes(card.leader_skill_set_id)){
            let leaderSQL = await passive_skill.importLeader(card,translatedcard.leader_nom,translatedcard.leader_skill)
            fs.appendFileSync('./japan_port.sql', leaderSQL);
            appliedLeaders.push(card.leader_skill_set_id)
        }
        if (lastDigit1Num === 1){
            let SAsImport = await passive_skill.importSAs(card,translatedcard,appliedSAs,viewIDS)
            fs.appendFileSync('./japan_port.sql', SAsImport.SQLCode)
            appliedSAs = appliedSAs.concat(SAsImport.appliedSAs)
            viewIDS = viewIDS.concat(SAsImport.viewIDS)
        }

        let activeSkill = await query(`SELECT * FROM card_active_skills WHERE card_id=${card.id}`,db_jap)
        if (activeSkill.length > 0){
            let ASimport = await passive_skill.importAS(card,translatedcard.AS_cond,translatedcard.AS_name,translatedcard.AS_desc)
            fs.appendFileSync('./japan_port.sql', ASimport.SQLCode)
            viewIDS = viewIDS.concat(ASimport.viewIDS)
            param_no = param_no.concat(ASimport.param_no)
        }
        fs.appendFileSync('./japan_port.sql',await passive_skill.importViews(viewIDS));
        if (!appliedChara.includes(card.character_id)){
            let charas = await passive_skill.importChara(card,translatedcard.nom)
            fs.appendFileSync('./japan_port.sql',charas)
            appliedChara.push(card.character_id)
        }
        fs.appendFileSync('./japan_port.sql',await passive_skill.categorie(card));


        if (!applieduniqInfos.includes(card.card_unique_info_id)){
            fs.appendFileSync('./japan_port.sql',await passive_skill.importUniqueInfos(card));
            applieduniqInfos.push(card.card_unique_info_id)
        }

        if (param_no.length > 0){
            fs.appendFileSync('./japan_port.sql',await passive_skill.importBattle_params(param_no));
        }
        fs.appendFileSync("./japan_port.sql",await passive_skill.importAwakRoutes(card))
        

        
        return {
            id: card.id,
            name: translatedcard.nom
        }
    }

    let rawdata = fs.readFileSync('whitelist.json');
    rawdata = JSON.parse(rawdata);
    banned = rawdata.banned

    fs.writeFileSync('./japan_port.sql', '')
    console.log(chalk.blue.bold("Génération du fichier \"japan_port.sql\" en cours..."))
    if (whitelist === null){
        for (let index = 0; index < exclusjap.length; index++) {
            const element = exclusjap[index];
            if (banned.includes(element.id)) continue;
            let carte = await implementCard(element)
            console.log(chalk.green(`✔️ ${carte.name} | ${carte.id} a été généré`))
        }
    } else {
        for (let index = 0; index < exclusjap.length; index++) {
            const element = exclusjap[index];
            if (!whitelist.includes(element.id)) continue;
            let carte = await implementCard(element)
            console.log(chalk.green(`✔️ ${carte.name} | ${carte.id} a été généré`))
        }
    }
    
    console.log(chalk.green.bold("Génération terminée !"))
    

}
async function getEZA_translation(card){
    let e = await axios.get(`https://dokkaninfo.com/cards/${card.id}`)
    let xsrf = e.headers['set-cookie'][0].split(";")
    let xsrf2 = e.headers['set-cookie'][1].split(";")
    let iub1 = "%7B%22timestamp%22%3A%222022-09-10T20%3A02%3A55.011Z%22%2C%22version%22%3A%221.41.0%22%2C%22purposes%22%3A%7B%221%22%3Atrue%2C%224%22%3Atrue%2C%225%22%3Atrue%7D%2C%22id%22%3A32465998%7D"
    let _iub_cs = "%7B%7D"
    let euconsent = "CPfFkMAPfFkMAB7EVBENCgCsAP_AAAAAAAAAI_td_H__bX9j-_5_6ft0eY1f9_r37uQzDhfNk-8F3L_W_LwX_2E7NF36tq4KmR4Eu1LBIQNlHMHUDUmwaokVrzHsak2cpzNKJ7JEknMZeydYGF9Pm1tj-YKY7_5_9_b52T-9_9v239z3_8ff__d5_2___vDfV5_9jfn9fV_789KP9_58v__8_____3____3___ghTAMABwAEsAz4CPAErgMEAY-A3MB2wDuQHggQpAJCQWgAEAALgAoACoAGQAOQAeACAAGAAMoAaABqADyAIYAigBMACeAFUAN4AcwA9AB-AEJAIYAiQBHACWAE0AKUAW4AwwBkADLAGyAO-AewB8QD7AP2Af4CBgEUgIuAjEBGgEcAJSAUEAp4BVwC5gGKANEAawA2gBuADiAHoAPkAh0BEICRAExAJlATsAocBSICmgFigLQAWwAuQBd4C8wGDAMNgZGBkgDJwGXAM5AZ8A0iBrAGsgNvAbqA4IBxEDkwOUAcuA8cB7QEIYIXAheBDkCHoEPwIhgRSAj6BH8NAdAC4AIYAZAAywBswD7APwAgABBQCMAFPAKvAWgBaQDWAHVAPkAh0BEwCKgEiAJ2AUiAuQBkYDJwGcgM8AZ8A5QCP4iAuAIYAZAAywBswD7APwAgABGACngFXANYAdUA-QCHQEiAJ2AUiAuQBkYDJwGcgM-AcoBH8VAWAAoAEMAJgAXABHADLAI4AVeAtAC0gJBATEAtgBcgC8wGRgM5AZ4Az4BuQDlAIXgR_GQFAAhgBMAEcAMsAjgBVwCtgJOATEAtEBbAC5AF5gMjAZyAzwBnwDlAIXgR_HQcQAFwAUABUADIAHIAPgBAAC6AGAAZQA0ADUAHgAPoAhgCKAEwAJ4AVYAuAC6AGIAMwAbwA5gB6AD9AIYAiQBLACYAE0AKMAUoAsQBbwDCAMOAZABlADRAGyAO8Ae0A-wD9AH-AQMAikBFgEYgI4AjsBKQEqAKCAU8Aq4BYoC0ALTAXMBdYC8gL0AYoA2gBuADiAHOAOoAegA-wCHQEQgIqAReAkEBIgCVAEyAJ2AUOApoBVgCxQFlALYAXAAuQBdoC7wF5gL6AYMAw0Bj0DIwMkAZOAyoBlgDLgGZgM5AZ8A0SBpAGkgNLAaqA1gBt4DdQHEAOLgcmBygDlwHjgPaAfWBAECDQEHgIXwQ5BDoCHoEUgI7AR9Aj-QgigALAAoABkAFwAMQAagBDACYAFMAKoAXAAxABmADeAHoARwApQBYgDCAGUAO8AfYA_wCKAEcAJSAUEAp4BV4C0ALSAXMAxQBtADnAHUAPQAiEBIICRAEnAJUAU0AqwBYoCygFogLYAXAAuQBdoDIwGTgM5AZ4Az4BogDSQGlgNVAcAA4gBygDxwIUAQvAh0BD0CPoEfyUD8ABAACwAKAAZAA4AB-AGAAYgA8ACIAEwAKoAXAAxABmgEMARIAjgBRgClAFuAMIAZQA2QB3wD7APwAjgBTwCrwFoAWmAuYC6gGKANwAdQA-QB9gEOgImARUAi8BIgCxQFlALYAXaAvMBkYDJwGWAM5AZ4Az4BpADWAG3gOAAe0BAECB4EIQIXgQ1Ah6BFkCP5SCqAAuACgAKgAZAA5AB8AIIAYABlADQANQAeQBDAEUAJgATwApABVADEAGYAOYAfoBDAESAKMAUoAsQBbgDCgGQAZQA0QBsgDvgH2AfoBFgCMQEcAR0AlIBQQCrgFbALmAXkAxQBtADcAHoAPsAh0BEwCLwEiAJOATsAocBVgCxQFoALYAXAAuQBdoC8wF9AMNgZGBkgDJwGWAMuAZyAzwBn0DSANJgawBrIDbwG6gOCgcmBygDlwHigPHAe0BCECF4EMwIdAQ9AiABFICOwEfwAA"
    var tok = new JSSoup(e.data).findAll('input').find(a => a.attrs.id === "csrf-token").attrs.value
    let cookie = `_iub_cs-32465998=${iub1}; euconsent-v2=${euconsent}; _iub_cs-32465998-granular=${_iub_cs}; ${xsrf[0]}; ${xsrf2[0]}`
    let config = {
        "headers": {
          "accept": "application/json",
          "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
          "content-type": "application/json",
          "eza": "true",
          "sec-ch-ua": "\"Google Chrome\";v=\"105\", \"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"105\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "transformation-id": card.id,
          "x-csrf-token": tok,
          "x-requested-with": "XMLHttpRequest",
          "cookie": cookie,
          "Referer": `https://dokkaninfo.com/cards/${card.id}`,
          "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": null,
        "method": "GET"
    }
    let a = await axios.get("https://dokkaninfo.com/cards/get_transformation",config)
    return a.data



    
}

async function ZTURAll(whitelist){
    fs.writeFileSync('./eza_port.sql', '')
    async function getZTURDiff(){
        let optimal_jap = await query("SELECT * FROM optimal_awakening_growths",db_jap)
        let optimal_glo = await query("SELECT * FROM optimal_awakening_growths",db_glo)
        let optimal_exclus = []
        let japan_eza_eclus = []
        for (let index = 0; index < optimal_jap.length; index++) {
            const growth = optimal_jap[index];
            if (optimal_glo.find(e => e.optimal_awakening_grow_type === growth.optimal_awakening_grow_type)) continue;
            if (optimal_exclus.includes(growth.optimal_awakening_grow_type)) continue;
            optimal_exclus.push(growth.optimal_awakening_grow_type)
        }
        for (let index = 0; index < optimal_exclus.length; index++) {
            const optimal = optimal_exclus[index];
            let card = await query(`SELECT * FROM cards WHERE optimal_awakening_grow_type=${optimal}`,db_jap)
            card = card[0]
            japan_eza_eclus.push(card)

            
        }
        return japan_eza_eclus
    }
    let cards = await getZTURDiff()
    async function port_eza(card) {
        let translated = await getEZA_translation(card)
        translated = translated[0]
        translated.leader_skill_description = translated.leader_skill_description.replace(/\<.+?\>/g, '').replaceAll("'", "''")
        let leaderSkills = []
        let passiveSkills = []
        fs.appendFileSync('./eza_port.sql',`UPDATE cards SET optimal_awakening_grow_type = ${card.optimal_awakening_grow_type} WHERE id=${card.id};\n`); 

        let optimal_awakenings = await query(`SELECT * FROM optimal_awakening_growths WHERE optimal_awakening_grow_type=${card.optimal_awakening_grow_type}`,db_jap)

        for (let index = 0; index < optimal_awakenings.length; index++) {
            const awakening = optimal_awakenings[index];
            fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO optimal_awakening_growths(id,optimal_awakening_grow_type,step,lv_max,skill_lv_max,passive_skill_set_id,leader_skill_set_id) VALUES(${awakening.id},${awakening.optimal_awakening_grow_type},${awakening.step},${awakening.lv_max},${awakening.skill_lv_max},${awakening.passive_skill_set_id},${awakening.leader_skill_set_id});\n`);
            if (!leaderSkills.includes(awakening.leader_skill_set_id)){
                leaderSkills.push(awakening.leader_skill_set_id)
            }
            if (!passiveSkills.includes(awakening.passive_skill_set_id)){
                passiveSkills.push(awakening.passive_skill_set_id)
            } 
        }

        for (let index = 0; index < passiveSkills.length; index++) {
            const passif_id = passiveSkills[index];
            let passiveRelations = await query(`SELECT * FROM passive_skill_set_relations WHERE passive_skill_set_id=${passif_id}`,db_jap)
            let passivesID = []
            let passif_glo = await query(`SELECT * FROM passive_skill_sets WHERE id=${passif_id}`,db_glo)
            let passif_jap = await query(`SELECT * FROM passive_skill_sets WHERE id=${passif_id}`,db_jap)
            passif_jap = passif_jap[0]
            if (passif_glo.length > 0) continue;
            let passive_name = ""
            let passive_desc = ""
            if (translated.passive_skill_id === passif_id) {
                passive_name = translated.passive_skill_name.replaceAll("'", "''")
                passive_desc = translated.passive_skill_description.replaceAll("'", "''")
            } else {
                passive_name = passif_jap.name
                passive_desc = passif_jap.description
            }
            fs.appendFileSync('./eza_port.sql', (await passive_skill.importPassive({passive_skill_set_id: passif_id},passive_name,passive_desc)).SQLCode);
            

        }

        for (let index = 0; index < leaderSkills.length; index++) {
            const leader_id = leaderSkills[index];
            let leader_glo = await query(`SELECT * FROM leader_skill_sets WHERE id=${leader_id}`,db_glo)
            let leader_jap = await query(`SELECT * FROM leader_skill_sets WHERE id=${leader_id}`,db_jap)
            leader_jap = leader_jap[0]
            if (leader_glo.length > 0) continue;
            let leader_name = ""
            let leader_desc = ""
            if (translated.leader_skill_sets_id === leader_id) {
                leader_name = translated.title.replaceAll("'", "''")
                leader_desc = translated.leader_skill_description.replaceAll("'", "''")
            } else {
                leader_name = leader_jap.name
                leader_desc = leader_jap.description
            }
            fs.appendFileSync('./eza_port.sql', await passive_skill.importLeader({leader_skill_set_id: leader_id},leader_name,leader_desc));
        }
        let spes_0 = await query(`SELECT * FROM card_specials WHERE card_id=${card.id - 1}`,db_jap)
        let spes_1 = await query(`SELECT * FROM card_specials WHERE card_id=${card.id}`,db_jap)

        for (let index = 0; index < spes_1.length; index++) {
            const SA = spes_1[index];
            let spe_set = await query(`SELECT * FROM special_sets WHERE id=${SA.special_set_id}`,db_jap)
            spe_set = spe_set[0]
            if (card.rarity === 5){
                var minimum = 24
            } else var minimum = 14
            if (SA.lv_start < minimum) continue;
            if (translated.super_attacks.find(e => e.id === SA.special_set_id)){
                let spetrans = translated.super_attacks.find(e => e.id === SA.special_set_id)
                var sp_name = spetrans.name.replaceAll("'", "''")
                var sp_desc = spetrans.description.replaceAll("'", "''")
                var sp_cond = spetrans.causality_description
            } else {
                var sp_name = spe_set.name
                var sp_desc = spe_set.description
                var sp_cond = spe_set.causality_description
            }

            if (sp_cond !== null) sp_cond = `'${sp_cond.replaceAll("'", "''")}'`
            var special_asset_id = null
            if (SA.special_asset_id !== null) special_asset_id = SA.special_asset_id
            let view_id = await query(`SELECT * FROM special_views WHERE id=${SA.view_id}`,db_jap)
            view_id = view_id[0]
            view_id = await query(`SELECT * FROM special_views WHERE script_name='${view_id.script_name}'`,db_glo)
            if (SA.causality_conditions !== null) SA.causality_conditions = `'${SA.causality_conditions}'`
            if (view_id.length > 0){
                SA.view_id = view_id[0].id
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO card_specials(id,card_id,special_set_id,priority,style,lv_start,eball_num_start,view_id,card_costume_condition_id,special_bonus_id1,special_bonus_lv1,bonus_view_id1,special_bonus_id2,special_bonus_lv2,bonus_view_id2,causality_conditions,special_asset_id,created_at,updated_at) VALUES(${SA.id},${SA.card_id},${SA.special_set_id},${SA.priority},'${SA.style}',${SA.lv_start},${SA.eball_num_start},${SA.view_id},${SA.card_costume_condition_id},${SA.special_bonus_id1},${SA.special_bonus_lv1},${SA.bonus_view_id1},${SA.special_bonus_id2},${SA.special_bonus_lv2},${SA.bonus_view_id2},${SA.causality_conditions},${special_asset_id},'${SA.created_at}','${SA.updated_at}');\n`);  
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO special_sets(id,name,description,causality_description,aim_target,increase_rate,lv_bonus,created_at,updated_at) VALUES(${spe_set.id},'${sp_name}','${sp_desc}',${sp_cond},${spe_set.aim_target},${spe_set.increase_rate},${spe_set.lv_bonus},'${spe_set.created_at}','${spe_set.updated_at}');\n`);
  
            } else {
                let view_id = await query(`SELECT * FROM special_views WHERE id=${SA.view_id}`,db_jap)
                view_id = view_id[0]
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO special_views(id,script_name,cut_in_card_id,special_name_no,special_motion,lite_flicker_rate,energy_color,special_category_id,created_at,updated_at) VALUES(${view_id.id},'${view_id.script_name}',${view_id.cut_in_card_id},${view_id.special_name_no},${view_id.special_motion},${view_id.lite_flicker_rate},${view_id.energy_color},${view_id.special_category_id},'${view_id.created_at}','${view_id.updated_at}');\n`);
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO card_specials(id,card_id,special_set_id,priority,style,lv_start,eball_num_start,view_id,card_costume_condition_id,special_bonus_id1,special_bonus_lv1,bonus_view_id1,special_bonus_id2,special_bonus_lv2,bonus_view_id2,causality_conditions,special_asset_id,created_at,updated_at) VALUES(${SA.id},${SA.card_id},${SA.special_set_id},${SA.priority},'${SA.style}',${SA.lv_start},${SA.eball_num_start},${SA.view_id},${SA.card_costume_condition_id},${SA.special_bonus_id1},${SA.special_bonus_lv1},${SA.bonus_view_id1},${SA.special_bonus_id2},${SA.special_bonus_lv2},${SA.bonus_view_id2},${SA.causality_conditions},${special_asset_id},'${SA.created_at}','${SA.updated_at}');\n`);
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO special_sets(id,name,description,causality_description,aim_target,increase_rate,lv_bonus,created_at,updated_at) VALUES(${spe_set.id},'${sp_name}','${sp_desc}',${sp_cond},${spe_set.aim_target},${spe_set.increase_rate},${spe_set.lv_bonus},'${spe_set.created_at}','${spe_set.updated_at}');\n`);
                }
            
            let specials = await query(`SELECT * FROM specials WHERE special_set_id=${SA.special_set_id}`,db_jap)
            for (let index = 0; index < specials.length; index++) {
                const special = specials[index];
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO specials(id,special_set_id,type,efficacy_type,target_type,calc_option,turn,prob,causality_conditions,eff_value1,eff_value2,eff_value3,created_at,updated_at) VALUES(${special.id},${special.special_set_id},'${special.type}',${special.efficacy_type},${special.target_type},${special.calc_option},${special.turn},${special.prob},${special.causality_conditions},${special.eff_value1},${special.eff_value2},${special.eff_value3},'${special.created_at}','${special.updated_at}');\n`);
            }
        }
        for (let index = 0; index < spes_0.length; index++) {
            const SA = spes_0[index];
            let view_id = await query(`SELECT * FROM special_views WHERE id=${SA.view_id}`,db_jap)
            view_id = view_id[0]
            view_id = await query(`SELECT * FROM special_views WHERE script_name='${view_id.script_name}'`,db_glo)
            var special_asset_id = null
            if (SA.special_asset_id !== null) special_asset_id = SA.special_asset_id
            if (view_id.length > 0){
                SA.view_id = view_id[0].id
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO card_specials(id,card_id,special_set_id,priority,style,lv_start,eball_num_start,view_id,card_costume_condition_id,special_bonus_id1,special_bonus_lv1,bonus_view_id1,special_bonus_id2,special_bonus_lv2,bonus_view_id2,causality_conditions,special_asset_id,created_at,updated_at) VALUES(${SA.id},${SA.card_id},${SA.special_set_id},${SA.priority},'${SA.style}',${SA.lv_start},${SA.eball_num_start},${SA.view_id},${SA.card_costume_condition_id},${SA.special_bonus_id1},${SA.special_bonus_lv1},${SA.bonus_view_id1},${SA.special_bonus_id2},${SA.special_bonus_lv2},${SA.bonus_view_id2},${SA.causality_conditions},${special_asset_id},'${SA.created_at}','${SA.updated_at}');\n`);    
            } else {
                let view_id = await query(`SELECT * FROM special_views WHERE id=${SA.view_id}`,db_jap)
                view_id = view_id[0]
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO special_views(id,script_name,cut_in_card_id,special_name_no,special_motion,lite_flicker_rate,energy_color,special_category_id,created_at,updated_at) VALUES(${view_id.id},'${view_id.script_name}',${view_id.cut_in_card_id},${view_id.special_name_no},${view_id.special_motion},${view_id.lite_flicker_rate},${view_id.energy_color},${view_id.special_category_id},'${view_id.created_at}','${view_id.updated_at}');\n`);
                fs.appendFileSync('./eza_port.sql',`INSERT OR REPLACE INTO card_specials(id,card_id,special_set_id,priority,style,lv_start,eball_num_start,view_id,card_costume_condition_id,special_bonus_id1,special_bonus_lv1,bonus_view_id1,special_bonus_id2,special_bonus_lv2,bonus_view_id2,causality_conditions,special_asset_id,created_at,updated_at) VALUES(${SA.id},${SA.card_id},${SA.special_set_id},${SA.priority},'${SA.style}',${SA.lv_start},${SA.eball_num_start},${SA.view_id},${SA.card_costume_condition_id},${SA.special_bonus_id1},${SA.special_bonus_lv1},${SA.bonus_view_id1},${SA.special_bonus_id2},${SA.special_bonus_lv2},${SA.bonus_view_id2},${SA.causality_conditions},${special_asset_id},'${SA.created_at}','${SA.updated_at}');\n`);    
            }
        }
        return {
            name: translated.name,
            id: card.id
        }  
        
    }
    let rawdata = fs.readFileSync('whitelist.json');
    rawdata = JSON.parse(rawdata);
    banned = rawdata.bannedEZA

    console.log(chalk.blue.bold("Génération du fichier \"eza_port.sql\" en cours..."))
    if (whitelist === null){
        for (let index = 0; index < cards.length; index++) {
            const element = cards[index];
            if (banned.includes(element.id)) continue;
            let carte = await port_eza(element)
            console.log(chalk.green(`✔️ ${carte.name} | ${carte.id} a été généré`))
        }
    } else {
        for (let index = 0; index < cards.length; index++) {
            const element = cards[index];
            if (!whitelist.includes(element.id)) continue;
            let carte = await port_eza(element)
            console.log(chalk.green(`✔️ ${carte.name} | ${carte.id} a été généré`))
        }
    }
    
    console.log(chalk.green.bold("Génération terminée !"))
    
}


async function main(){
    let nodb = false
    const path_db1 = path.join(__dirname, "/databases/db_jap.db")
    if (!fs.existsSync(path_db1)){
        console.log(chalk.red("❌ ERREUR | La database JAP est absente. Elle doit être dans le chemin suivant : `/databases/db_jap.db`"))
        nodb = true
    }
    const path_db2 = path.join(__dirname, "/databases/db_glo.db")
    if (!fs.existsSync(path_db2)){
        console.log(chalk.red("❌ ERREUR | La database GLO est absente. Elle doit être dans le chemin suivant : `/databases/db_glo.db`"))
        nodb = true
    }
    if (nodb) return;
    console.log(chalk.redBright(figlet.textSync('Auto Jap Port', { horizontalLayout: 'fitted' })))
    let prompt = await inquirer.prompt([{
        type: 'list',
        message: 'Choisis une option',
        name: "option",
        choices: ["Générer et traduire toutes les exclus JAP","Générer et traduire seulement les persos dans la whitelist.json","Générer et traduire tous les ZTUR","Générer et traduire seulement les ZTUR dans la whitelist.json","Générer le fichier misc.sql",chalk.red("Quitter")]
    }])
    let choice = prompt.option
    if (choice === "Générer et traduire toutes les exclus JAP"){
        await tradAll(null)
        return main()
    }
    if (choice === "Générer le fichier misc.sql"){
        await includeEffect_Pack()
        return main()
    }

    if (choice === "Générer et traduire seulement les persos dans la whitelist.json"){
        let rawdata = fs.readFileSync('whitelist.json');
        rawdata = JSON.parse(rawdata);
        whitelist = rawdata.whitelist
        await tradAll(whitelist)
        return main()
    }
    if (choice === "Générer et traduire tous les ZTUR"){
        await ZTURAll(null)
        return main()
    }
    if (choice === "Générer et traduire seulement les ZTUR dans la whitelist.json"){
        let rawdata = fs.readFileSync('whitelist.json');
        rawdata = JSON.parse(rawdata);
        whitelist = rawdata.whitelistEZA
        await ZTURAll(whitelist)
        return main()
    }
    if (choice === chalk.red("Quitter")){
        return;
    }
}
main()









