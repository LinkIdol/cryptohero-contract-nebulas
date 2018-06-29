/**
 * CryptoHero Contract Nebulas Version
 * ©️ Andoromeda Foundation All Right Reserved.
 * @author: Frank Wei <frank@frankwei.xyz>
 * @version: 1.0
 */
"use strict"


class Operator {
    constructor(obj) {
        this.operator = {}
        this.parse(obj)
    }

    toString() {
        return JSON.stringify(this.operator)
    }

    parse(obj) {
        if (typeof obj != "undefined") {
            var data = JSON.parse(obj)
            for (var key in data) {
                this.operator[key] = data[key]
            }
        }
    }

    get(key) {
        return this.operator[key]
    }

    set(key, value) {
        this.operator[key] = value
    }
}

class Tool {
    static fromNasToWei(value) {
        return new BigNumber("1000000000000000000").times(value)
    }
    static fromWeiToNas(value) {
        if (value instanceof BigNumber) {
            return value.dividedBy("1000000000000000000")
        } else {
            return new BigNumber(value).dividedBy("1000000000000000000")
        }
    }
    static getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }
}

/**
 * For Test Only
 */
// Mainnet
const basePrice = Tool.fromNasToWei(0.0001)
const addPricePerCard = Tool.fromNasToWei(0.00001)
// // Testnet
// const basePrice = Tool.fromNasToWei(0.000000001)
// const addPricePerCard = Tool.fromNasToWei(0.0000000001)
const initialTokenPrice = Tool.fromNasToWei(10000)
class StandardNRC721Token {
    constructor() {
        // Contract Need to store on-chain data in LocalContractStorage
        LocalContractStorage.defineProperties(this, {
            _name: null,
            _symbol: null
        })
        LocalContractStorage.defineMapProperties(this, {
            "tokenOwner": null,
            "ownedTokensCount": null,
            "tokenApprovals": null,
            "operatorApprovals": {
                parse(value) {
                    return new Operator(value)
                },
                stringify(o) {
                    return o.toString()
                }
            },
        })
    }

    init(name, symbol) {
        this._name = name
        this._symbol = symbol
    }

    name() {
        return this._name
    }

    symbol() {
        return this._symbol
    }

    balanceOf(_owner) {
        var balance = this.ownedTokensCount.get(_owner)
        return balance
    }

    ownerOf(_tokenId) {
        return this.tokenOwner.get(_tokenId)
    }

    approve(_to, _tokenId) {
        var from = Blockchain.transaction.from

        var owner = this.ownerOf(_tokenId)
        if (_to == owner) {
            throw new Error("invalid address in approve.")
        }
        // msg.sender == owner || isApprovedForAll(owner, msg.sender)
        if (owner == from || this.isApprovedForAll(owner, from)) {
            this.tokenApprovals.set(_tokenId, _to)
            this.approveEvent(true, owner, _to, _tokenId)
        } else {
            throw new Error("permission denied in approve.")
        }
    }

    getApproved(_tokenId) {
        return this.tokenApprovals.get(_tokenId)
    }

    setApprovalForAll(_to, _approved) {
        var from = Blockchain.transaction.from
        if (from == _to) {
            throw new Error("invalid address in setApprovalForAll.")
        }
        var operator = this.operatorApprovals.get(from) || new Operator()
        operator.set(_to, _approved)
        this.operatorApprovals.set(from, operator)
    }

    isApprovedForAll(_owner, _operator) {
        var operator = this.operatorApprovals.get(_owner)
        if (operator != null) {
            if (operator.get(_operator) === "true") {
                return true
            } else {
                return false
            }
        }
    }

    isApprovedOrOwner(_spender, _tokenId) {
        var owner = this.ownerOf(_tokenId)
        return _spender == owner || this.getApproved(_tokenId) == _spender || this.isApprovedForAll(owner, _spender)
    }

    rejectIfNotApprovedOrOwner(_tokenId) {
        var from = Blockchain.transaction.from
        if (!this.isApprovedOrOwner(from, _tokenId)) {
            throw new Error("permission denied in transferFrom.")
        }
    }

    transferFrom(_from, _to, _tokenId) {
        var from = Blockchain.transaction.from
        if (this.isApprovedOrOwner(from, _tokenId)) {
            this.clearApproval(_from, _tokenId)
            this.removeTokenFrom(_from, _tokenId)
            this._addTokenTo(_to, _tokenId)
            this.transferEvent(true, _from, _to, _tokenId)
        } else {
            throw new Error("permission denied in transferFrom.")
        }
    }

    clearApproval(_owner, _tokenId) {
        var owner = this.ownerOf(_tokenId)
        if (_owner != owner) {
            throw new Error("permission denied in clearApproval.")
        }
        this.tokenApprovals.del(_tokenId)
    }

    removeTokenFrom(_from, _tokenId) {
        if (_from != this.ownerOf(_tokenId)) {
            throw new Error("permission denied in removeTokenFrom.")
        }
        var tokenCount = this.ownedTokensCount.get(_from)
        if (tokenCount < 1) {
            throw new Error("Insufficient account balance in removeTokenFrom.")
        }
        this.tokenOwner.delete(_tokenId)
        this.ownedTokensCount.set(_from, tokenCount - 1)
    }

    // These function can be directly called without underscore in the first letter
    _addTokenTo(_to, _tokenId) {
        this.tokenOwner.set(_tokenId, _to)
        var tokenCount = this.ownedTokensCount.get(_to) || 0
        this.ownedTokensCount.set(_to, tokenCount + 1)
    }

    _mint(_to, _tokenId) {
        this._addTokenTo(_to, _tokenId)
        this.transferEvent(true, "", _to, _tokenId)
    }

    _mcards(_to, tokenId, heroId, price) {
        var cards = this.getCardInfos(_to);
        const card = {
            tokenId,
            heroId,
            price
        }
        const result = cards.concat(card)
        this.cardInfos.set(_to, result)
        this.transferEvent(true, "", _to, tokenId)
        return card;
    }
    _burn(_owner, _tokenId) {
        this.clearApproval(_owner, _tokenId)
        this.removeTokenFrom(_owner, _tokenId)
        this.transferEvent(true, _owner, "", _tokenId)
    }

    transferEvent(status, _from, _to, _tokenId) {
        Event.Trigger(this.name(), {
            Status: status,
            Transfer: {
                from: _from,
                to: _to,
                tokenId: _tokenId
            }
        })
    }

    approveEvent(status, _owner, _spender, _tokenId) {
        Event.Trigger(this.name(), {
            Status: status,
            Approve: {
                owner: _owner,
                spender: _spender,
                tokenId: _tokenId
            }
        })
    }
}

class TradableNRC721Token extends StandardNRC721Token {
    constructor() {
        super()
        LocalContractStorage.defineMapProperties(this, { "tokenPrice": null })
    }

    onlyTokenOwner(_tokenId) {
        const { from } = Blockchain.transaction
        var owner = this.ownerOf(_tokenId)
        if (from != owner) {
            throw new Error("Sorry, But you don't have the permission as the owner of the token.")
        }
    }

    priceOf(_tokenId) {
        return this.tokenPrice.get(_tokenId)
    }

    // _value: unit should be nas
    setTokenPrice(_tokenId, _value) {
        this.onlyTokenOwner(_tokenId)
        this.tokenPrice.set(_tokenId, Tool.fromNasToWei(_value))
    }

    setTokenPriceOfCards(_tokenId, _value) {
        this.onlyTokenOwner(_tokenId)
        const { from } = Blockchain.transaction
        var cards = this.getCardInfos(from)
        var info = []
        for (const card of cards) {
            if (card.tokenId == _tokenId) {
                info.push({
                    tokenId: card.tokenId,
                    heroId: card.heroId,
                    price: Tool.fromNasToWei(_value)
                })
            } else {
                info.push({
                    tokenId: card.tokenId,
                    heroId: card.heroId,
                    price: card.price
                })
            }
        }
        this.cardInfos.set(from, info)
    }
    buyToken(_tokenId) {
        const { value, from } = Blockchain.transaction
        const price = new BigNumber(this.priceOf(_tokenId))
        const tokenOwner = this.ownerOf(_tokenId)
        if (value.lt(price)) {
            throw new Error("Sorry, insufficient bid.")
        }
        const remain = value.minus(price)
        Blockchain.transfer(from, remain)
        const profit = value.times(97).dividedToIntegerBy(100)
        Blockchain.transfer(tokenOwner, profit)
        this._transferHeroToken(_tokenId, from)
        this.tokenPrice.set(_tokenId, initialTokenPrice)

        const _heroId = this.getHeroIdByTokenId(_tokenId)
        const card = []
        card.push({
            tokenId: _tokenId,
            heroId: _heroId,
            price: initialTokenPrice
        })
        this._transferHeroTokenOfCards(card, from)
    }
}

class CryptoHeroToken extends TradableNRC721Token {
    constructor() {
        super()
        LocalContractStorage.defineProperties(this, {
            _length: null,
            totalQty: null,
        })
        LocalContractStorage.defineMapProperties(this, {
            "tokenHeroId": null,
            "userToTokens": {
                parse(value) {
                    return JSON.parse(value)
                },
                stringify(o) {
                    return JSON.stringify(o)
                }
            },
            "cardInfos": {
                parse(value) {
                    return JSON.parse(value)
                },
                stringify(o) {
                    return JSON.stringify(o)
                }
            }
        })
    }

    init(name = "CryptoHero", symbol = "hero", totalQty = "21000000") {
        super.init(name, symbol)
        this._length = 0
        this.totalQty = new BigNumber(totalQty)
    }

    _issue(_to, _heroId) {
        if (this.isSoldOut()) {
            throw new Error("Sorry, the card pool is empty now.")
        } else {
            var tokenId = this._length
            this._mint(_to, tokenId)
            this.totalQty = new BigNumber(this.totalQty).minus(1);
            this.tokenHeroId.set(tokenId, _heroId)
            this.tokenPrice.set(tokenId, initialTokenPrice)
            var result = this._mcards(_to, tokenId, _heroId, initialTokenPrice)
            this._length += 1;
            return result
        }
    }

    isSoldOut() {
        return new BigNumber(0).gte(this.totalQty)
    }

    isTokenClaimed(tokenId) {
        return this.tokenClaimed.get(tokenId) !== null
    }

    getCardsLeft() {
        return new BigNumber(this.totalQty).toString(10);
    }

    getCardsByAddress(address) {
        // I just want to be a functional hipster, what's wrong with map, nebulas?
        // Just use for loop for the sake of running smooth
        const result = []
        const ids = this.getUserTokens(address)
        for (const tokenId of ids) {
            const heroId = this.getHeroIdByTokenId(tokenId)
            const price = this.priceOf(tokenId)
            const claimed = this.isTokenClaimed(tokenId)
            result.push({
                tokenId,
                price,
                heroId,
                claimed
            })
        }
        return result
    }

    getHeroIdByTokenId(_tokenId) {
        return this.tokenHeroId.get(_tokenId)
    }

    getCardInfos(_address) {
        const result = this.cardInfos.get(_address)
        if (result === null) {
            return []
        } else {
            return result
        }
    }
    getUserTokens(_address) {
        const result = this.userToTokens.get(_address)
        if (result === null) {
            return []
        } else {
            return result
        }
    }

    getHerosIdByTokens(tokens) {
        return tokens.map((token) => this.getHeroIdByTokenId(token))
    }

    getPricesOfTokens(tokens) {
        return tokens.map((token) => this.priceOf(token))
    }

    getTokensClaimStat(tokens) {
        return tokens.map((token) => this.isTokenClaimed(token))
    }

    // push elements can be a single id or array of ids thanks to concat!
    _pushToUserTokenMapping(_address, pushElements) {
        const result = this.getUserTokens(_address)
        // should be immutable
        const newResult = result.concat(pushElements)
        this.userToTokens.set(_address, newResult)
    }
    _pushToUserTokenMappingOfCards(_address, pushElements) {
        const result = this.getCardInfos(_address)
        const newResult = result.concat(pushElements);
        this.cardInfos.set(_address, newResult)
    }
    // tokenId should be Number, not string
    _removeTokenFromUser(_address, _tokenId) {
        const result = this.getUserTokens(_address)
        // should be immutable
        const newResult = result.filter((curTokenId) => curTokenId !== _tokenId)
        if (result.length - 1 === newResult.length) {
            this.userToTokens.set(_address, newResult)
            return true
        } else {
            throw new Error("No Token was found for the given address")
        }
    }

    _removeTokenFromUserOfCards(_address, _tokenId) {
        const result = this.cardInfos(_address)
        // should be immutable
        const newResult = result.filter((card) => card.tokenId !== _tokenId)
        if (result.length - 1 === newResult.length) {
            this.cardInfos.set(_address, newResult)
            return true
        } else {
            throw new Error("No Token was found for the given address")
        }
    }
    // This function has been cached.
    // _getTokenIDsByAddress(_address) {
    //     var result = []
    //     for (let id = 0; id < this._length; id += 1) {
    //         if (this.ownerOf(id) === _address) {
    //             result.push(id)
    //         }
    //     }
    //     return result
    // }

    getTotalSupply() {
        return this._length
    }
}

class OwnerableContract extends CryptoHeroToken {
    constructor() {
        super()
        LocalContractStorage.defineProperties(this, { owner: null })
        LocalContractStorage.defineMapProperties(this, { "admins": null })
    }

    init() {
        super.init()
        const { from } = Blockchain.transaction
        this.admins.set(from, "true")
        this.owner = from
    }

    onlyAdmins() {
        const { from } = Blockchain.transaction
        if (!this.admins.get(from)) {
            throw new Error("Sorry, You don't have the permission as admins.")
        }
    }

    onlyContractOwner() {
        const { from } = Blockchain.transaction
        if (this.owner !== from) {
            throw new Error("Sorry, But you don't have the permission as owner.")
        }
    }

    getContractOwner() {
        return this.owner
    }

    getAdmins() {
        return this.admins
    }

    setAdmins(address) {
        this.onlyContractOwner()
        this.admins.set(address, "true")
    }
}

class CryptoHeroContract extends OwnerableContract {
    constructor() {
        super()
        LocalContractStorage.defineProperties(this, {
            drawChances: null,
            drawPrice: null,
            referCut: null,
            myAddress: null,
            shares: null,
            totalEarnByShareAllUser: null,
            totalEarnByReferenceAllUser: null,
            holders: null
        })
        LocalContractStorage.defineMapProperties(this, {
            "tokenClaimed": null,
            "shareOfHolder": null,
            "totalEarnByShare": {
                parse(value) {
                    return JSON.parse(value)
                },
                stringify(o) {
                    return JSON.stringify(o)
                }
            },
            "totalEarnByReference": {
                parse(value) {
                    return JSON.parse(value)
                },
                stringify(o) {
                    return JSON.stringify(o)
                }
            },
            "sharePriceOf": {
                parse(value) {
                    return JSON.parse(value)
                },
                stringify(o) {
                    return JSON.stringify(o)
                }
            }
        })
    }

    init(initialPrice = basePrice, drawChances = {
        thug: 500,
        bigDipper: 250,
        goon: 10,
        easterEgg: 1
    }) {
        super.init()
        this.drawPrice = new BigNumber(initialPrice)
        this.referCut = new BigNumber(5)
        this.totalEarnByReferenceAllUser = new BigNumber(0)
        this.totalEarnByShareAllUser = new BigNumber(0)
        this.drawChances = drawChances
        this.shares = 0
        this.holders = []
    }

    _transferHeroToken(_tokenId, to) {
        const tokenOwner = this.tokenOwner.get(_tokenId)
        this.tokenOwner.set(_tokenId, to)
        this._removeTokenFromUser(tokenOwner, _tokenId)
        this._pushToUserTokenMapping(to, _tokenId)
    }
    _transferHeroTokenOfCards(card, to) {
        const tokenOwner = this.tokenOwner.get(card.tokenId)
        this.tokenOwner.set(card.tokenId, to)
        this._removeTokenFromUserOfCards(tokenOwner, card.tokenId)
        this._pushToUserTokenMappingOfCards(to, card)
    }
    countHerosBy(tokens) {
        var tag = {}
        var countHero = 0
        var countEvil = 0
        var countGod = 0
        var taggedHeroes = []
        var taggedEvils = []
        var taggedGod = []
        tokens.forEach((token) => {
            const heroId = this.tokenHeroId.get(token)
            // Only count the token that not claimed yet
            if (!this.isTokenClaimed(token) && typeof tag[heroId] === "undefined") {
                if (heroId >= 1 && heroId <= 108) {
                    countHero += 1
                    taggedHeroes.push(token)
                } else if (heroId == 0) {
                    countGod += 1
                    taggedGod.push(token)
                } else {
                    countEvil += 1
                    taggedEvils.push(token)
                }
                tag[heroId] = true
            }
        })
        return {
            countHero,
            countEvil,
            countGod,
            tag,
            taggedHeroes,
            taggedEvils,
            taggedGod
        }
    }

    countHerosByAddress(_address) {
        const tokens = this.getUserTokens(_address)
        return this.countHerosBy(tokens)
    }

    _claim(tag, tokens, l, r) {
        for (const tokenId of tokens) {
            const heroId = this.tokenHeroId.get(tokenId)
            if (tag[heroId] == true) {
                if (heroId >= l && heroId <= r) {
                    this.tokenClaimed.set(tokenId, true)
                }
            }
        }
        this.drawPrice = new BigNumber(this.drawPrice).minus(addPricePerCard.times(r - l + 1))
    }

    triggerShareEvent(status, shareHolder, share) {
        Event.Trigger(this.name(), {
            Status: status,
            Share: {
                shareHolder,
                share
            }
        })
    }

    getMyAddress() {
        return this.myAddress
    }

    getBalance() {
        var balance = new BigNumber(Blockchain.getAccountState(this.myAddress).balance);
        return balance
    }

    _addHolderShare(holder, share) {
        Blockchain.transfer(holder, share)
        this.triggerShareEvent(true, holder, share)
        if (this.totalEarnByShare.get(holder) == null) {
            this.totalEarnByShare.set(holder, new BigNumber(0))
        }
        this.totalEarnByShare.set(holder, new BigNumber(this.totalEarnByShare.get(holder)).plus(share))
        this.totalEarnByShareAllUser = new BigNumber(this.totalEarnByShareAllUser).plus(share)
    }

    _share() {
        if (this.shares == 0) {
            return;
        }
        var balance = this.getBalance()
        var unit = balance.dividedToIntegerBy(this.shares)
        for (const holder of this.holders) {
            const share = unit.times(this.shareOfHolder.get(holder))
            this._addHolderShare(holder, share)
        }
    }

    getHolders() {
        return this.holders
    }

    getHoldersStat() {
        const { holders } = this
        var result = []
        for (const holder of holders) {
            const balance = this.getShareOfHolder(holder)
            result.push({
                holder,
                balance
            })
        }
        return result
    }

    getHoldersStatHipster() {
        const { holders } = this
        const result = holders.map((holder) => {
            const balance = this.getShareOfHolder(holder)
            return {
                holder,
                balance
            }
        })
        return result
    }

    claim() {
        const { from } = Blockchain.transaction

        const {
            countHero,
            countEvil,
            countGod,
            taggedHeroes,
            taggedEvils,
            taggedGod,
            tag,
            tokens
        } = this.countHerosByAddress(from)
        if (countHero !== 108 && countEvil !== 6 && countGod !== 1) {
            throw new Error("Sorry, you don't have enough token to claim.")
        }
        this._share()
        if (countHero == 108) {
            this._claim(tag, taggedHeroes, 1, 108)
            this._addShare(from, 1)
        }
        if (countEvil == 6) {
            this._claim(tag, taggedEvils, 109, 114)
            this._addShare(from, 6)
        }
        if (countGod == 1) {
            this._claim(tag, taggedGod, 0, 0)
            this._addShare(from, 10)
        }

        this.claimEvent(true, from, tokens)
    }

    // status should be boolean
    claimEvent(status, from, claimedTokens) {
        Event.Trigger(this.name(), {
            Status: status,
            Claim: {
                from,
                claimedTokens
            }
        })
    }

    getSharePrice(user) {
        return this.sharePriceOf.get(user)
    }

    // _value: unit should be nas
    setSharePrice(_value) {
        var { from } = Blockchain.transaction
        this.sharePriceOf.set(from, Tool.fromNasToWei(_value))
    }

    cheatShare(amount) {
        this.onlyAdmins()
        if (this.shares >= 100) {
            throw new Error("Sorry, you can not cheat any more.")
        }
        const { from } = Blockchain.transaction
        this._addShare(from, parseInt(amount))
    }

    _addShare(holder, delta) {
        if (this.shareOfHolder.get(holder) == null) {
            this.holders = this.holders.concat(holder)
            this.sharePriceOf.set(holder, Tool.fromNasToWei(10000))
            this.shareOfHolder.set(holder, 0)
        }
        this.shareOfHolder.set(holder, this.shareOfHolder.get(holder) + delta)
        this.shares += delta
    }

    buyShare(seller) {
        const { value, from } = Blockchain.transaction
        const price = this.getSharePrice(seller)
        if (this.getShareOfHolder(seller) == null || this.getShareOfHolder(seller) <= 0) {
            throw new Error("Sorry, insufficient share.")
        }
        if (value.lt(price)) {
            throw new Error("Sorry, insufficient bid.")
        }

        var remain = new BigNumber(value).minus(price)
        Blockchain.transfer(from, remain)
        Blockchain.transfer(seller, price)
        this.shareOfHolder.set(seller, this.getShareOfHolder(seller) - 1)

        if (this.shareOfHolder.get(from) == null) {
            this.holders = this.holders.concat(from)
            this.sharePriceOf.set(from, Tool.fromNasToWei(10000))
            this.shareOfHolder.set(from, 0)
        }
        this.shareOfHolder.set(from, this.getShareOfHolder(from) + 1)
    }

    getDrawPrice() {
        return this.drawPrice
    }

    // For keeping price to fiat
    changePrice(value) {
        this.onlyAdmins()
        this.drawPrice = new BigNumber(value)
    }

    changeReferPercentage(value) {
        this.onlyAdmins()
        if (value > 100) {
            throw new Error("Refer Percentage above 100 is ridiculous, we are not selling for lost")
        } else {
            this.referCut = new BigNumber(value)
        }
    }

    getTotalEarnByReferenceAllUser() {
        return this.totalEarnByReferenceAllUser
    }

    getTotalEarnByShareAllUser() {
        return this.totalEarnByShareAllUser
    }

    getTotalEarnByReference(user) {
        return this.totalEarnByReference.get(user)
    }

    getTotalEarnByShare(user) {
        return this.totalEarnByShare.get(user)
    }

    getShares() {
        return this.shares
    }

    getShareOfHolder(holder) {
        return this.shareOfHolder.get(holder)
    }

    getReferPercentage() {
        return this.referCut
    }

    getType(r) {
        const {
            thug,
            bigDipper,
            goon
        } = this.drawChances
        if (r <= bigDipper * 36) {
            return {
                offset: 1,
                count: 36
            }
        }
        r -= bigDipper * 36;
        if (r <= thug * 72) {
            return {
                offset: 37,
                count: 72
            }
        }
        r -= thug * 72
        if (r <= goon * 6) {
            return {
                offset: 109,
                count: 6
            }
        }
        return {
            offset: 0,
            count: 1
        }
    }

    _dynamicDraw(from) {
        const {
            thug,
            bigDipper,
            goon,
            easterEgg
        } = this.drawChances
        const r = Tool.getRandomInt(0, bigDipper * 36 + thug * 72 + goon * 6 + easterEgg)
        const {
            offset,
            count
        } = this.getType(r)
        const randomHeroId = offset + Tool.getRandomInt(0, count)
        var card = this._issue(from, randomHeroId)
        return card
    }

    _issueMultipleCard(from, qty) {
        const resultArray = []
        const resultCard = []
        for (let i = 0; i < qty; i += 1) {
            var card = this._dynamicDraw(from)
            resultArray.push(card.tokenId)
            resultCard.push(card)
        }
        const totalAdd = new BigNumber(addPricePerCard).times(qty)
        this.drawPrice = totalAdd.plus(this.drawPrice)
        this._pushToUserTokenMapping(from, resultArray)
        this._pushToUserTokenMappingOfCards(from, resultCard)
        return resultCard
    }

    _getDrawCount(value) {
        var remain = new BigNumber(value)
        var count = 0
        var offset = new BigNumber(0)
        const { drawPrice } = this
        while (remain.gte(offset.plus(drawPrice))) {
            count += 1
            remain = remain.minus(offset.plus(drawPrice))
            offset = offset.plus(new BigNumber(addPricePerCard))
        }
        const actualCost = new BigNumber(value).minus(remain)
        return {
            count,
            remain,
            actualCost
        }
    }

    triggerDrawEvent(status, _from, tokens) {
        const herosId = tokens.map((token) => this.getHeroIdByTokenId(token.tokenId))
        Event.Trigger(this.name(), {
            Status: status,
            Draw: {
                from: _from,
                tokens,
                herosId
            }
        })
    }

    // referer by default is empty
    draw(referer = "") {
        var {
            from,
            value
        } = Blockchain.transaction
        const {
            count,
            remain,
            actualCost
        } = this._getDrawCount(value)
        Blockchain.transfer(from, remain)
        if (count > 0) {
            const result = this._issueMultipleCard(from, count)
            this.triggerDrawEvent(true, from, result)
            this._sendCommissionTo(referer, actualCost)
            return result
        } else {
            throw new Error("You don't have enough token, try again with more.")
        }
    }

    airdrop(to = "", referer = "") {
        const cards = this.draw(referer)
        if (to !== "") {
            for (const card of cards) {
                // this.tokenOwner.set(token, to)
                this._transferHeroToken(card.tokenId, to)
                this._transferHeroTokenOfCards(card, to)
            }
        }
    }

    _sendCommissionTo(referer, actualCost) {
        const { referCut } = this
        if (referer !== "") {
            const withoutCut = new BigNumber(100).dividedToIntegerBy(referCut)
            const cut = actualCost.dividedToIntegerBy(withoutCut)
            Blockchain.transfer(referer, cut)
            if (this.totalEarnByReference.get(referer) == null) {
                this.totalEarnByReference.set(referer, new BigNumber(0))
            }
            this.totalEarnByReference.set(referer, new BigNumber(this.totalEarnByReference.get(referer)).plus(cut))
            this.totalEarnByReferenceAllUser = new BigNumber(this.totalEarnByReferenceAllUser).plus(cut)
        }
    }

    setMyAddress() {
        this.onlyContractOwner()
        this.myAddress = Blockchain.transaction.to
    }

    cheat() {
        this.onlyContractOwner()
        if (this._length >= 100) {
            throw new Error("This function is one time use.")
        }
        const { from } = Blockchain.transaction
        const cards = this._issueMultipleCard(from, 115)
        var heroId = 0
        for (const card of cards) {
            this.tokenHeroId.set(card.tokenId, heroId)
            heroId += 1;
        }
    }

    ready() {
        this.setMyAddress()
        this.cheat()
        this.cheatShare(1)
    }

    withdraw(value) {
        this.onlyAdmins()
        // Only the owner can have the withdraw fund, so be careful
        return Blockchain.transfer(this.owner, new BigNumber(value))
    }

    withdrawAll() {
        this.withdraw(this.getBalance())
    }
}

module.exports = CryptoHeroContract