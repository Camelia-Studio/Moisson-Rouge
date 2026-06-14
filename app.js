(function () {

    angular.module('app', ['angular-locker']);

    AppCtrl.$inject = ['$http', 'locker'];
    function AppCtrl($http, locker) {
        var vm = this;

        vm.simultaneous = locker.get('simultaneous', 1);
        vm.totalSteps = 17;
        vm.sorting = locker.get('sorting', 0);
        vm.saveData = locker.get('save');
        vm.displayOwnedMonsters = locker.get('displayOwnedMonsters', true);
        vm.displayFinishedZones = locker.get('displayFinishedZones', true);
        vm.displayFinishedSteps = locker.get('displayFinishedSteps', true);

        vm.isOwned = function(monster) {
             if (!monster) return false;
             return monster.owned >= vm.simultaneous;
        };

        vm.saveMonster = function(monster, val) {
            vm.saveData = locker.get('save', []);
            if (vm.saveData.find(savedMonster => savedMonster[0] === monster.id)) {
                vm.saveData[vm.saveData.findIndex(savedMonster => savedMonster[0] === monster.id)][1] = monster.owned;
            } else {
                vm.saveData.push([monster.id, monster.owned]);
            }

            locker.put('save', vm.saveData);
        };

        vm.increase = function(monster) {
            monster.owned++;
            vm.saveMonster(monster);
        };

        vm.decrease = function(monster) {
            if(monster.owned > 0) {
                monster.owned--;
            }
            vm.saveMonster(monster);
        };

        vm.saveSimultaneous = function () {
            locker.put('simultaneous', vm.simultaneous)
        }

        vm.owned = function(type, zone, step) {
            if (!vm.monsters) return '?';

            return vm.monsters.reduce(function(total, monster) {
                if (
                    (type && monster.type !== type) ||
                    (zone && monster.zones.indexOf(zone) < 0) ||
                    (step && monster.step !== step)
                ) {
                    return total;
                }

                return total + Math.min(monster.owned, vm.simultaneous);
            }, 0);
        };

        vm.ownedPercentage = function(type, zone, step) {
            const total = vm.total(type, zone, step);
            if (typeof total !== 'number' || total === 0) return 0;
            return Math.ceil(vm.owned(type, zone, step) * 100 / total);
        };

         vm.total = function(type, zone, step) {
            if (!vm.monsters) {
                return '?';
            }

            let base = vm.monsters.filter(function(monster) {
                if (type && monster.type !== type) return false;
                if (zone && !monster.zones.includes(zone)) return false;
                if (step && monster.step !== step) return false;
                return true;
             });

            return base.length * vm.simultaneous;
        };


        vm.load = function() {
            locker.put('save', vm.loadData.match(/\d+,\d+/gm).map(function(id) {
                return [+id.split(',')[0],+id.split(',')[1]];
            }));

            vm.saveData = locker.get('save');
        };

        vm.toggleZone = function(zone) {
            var newVal = true;

            if (vm.owned(false, zone) == vm.total(false, zone)) {
                newVal = false;
            }

            vm.monsters.map(function(monster) {
                if (monster.zones.indexOf(zone) >= 0) {
                    monster.owned = newVal ? vm.simultaneous : 0;
                    vm.saveMonster(monster);
                }
            });
        };

        vm.toggleStep = function(step) {
            var newVal = vm.simultaneous;

            if (vm.owned(false, false, step) == vm.total(false, false, step)) {
                newVal = 0;
            }

            vm.monsters.map(function(monster) {
                if (monster.step == step) {
                    monster.owned = newVal;
                    vm.saveMonster(monster);
                }
            });
        };

        vm.completedSteps = function() {
            if (!vm.monsters) {
                return '??';
            }

            return vm.monsters.map(function(monster) {
                return monster.step;
            }).sort().filter(function(step, index, steps) {
                return index == steps.indexOf(step);
            }).filter(function(step) {
                return vm.ownedPercentage(false, false, step) == 100;
            }).length;
        };

        vm.completedStepsPercentage = function() {
            return Math.ceil(vm.completedSteps() * 100 / vm.totalSteps);
        };

        vm.chooseSorting = function(sorting) {
            vm.sorting = sorting;

            locker.put('sorting', sorting);
        };


        vm.toggleOwnedMonsters = function() {
            locker.put('displayOwnedMonsters', vm.displayOwnedMonsters);
        }

        vm.toggleFinishedZones = function() {
            locker.put('displayFinishedZones', vm.displayFinishedZones);
        }

        vm.toggleFinishedSteps = function() {
            locker.put('displayFinishedSteps', vm.displayFinishedSteps);
        }

        vm.adjustedTotal = function() {
            if (!vm.monsters) return '?';
            return vm.monsters.length * vm.simultaneous;
        };

        vm.monsterStatus = function(monster) {
            if (monster.owned >= vm.simultaneous) return 'complete'; // vert
            if (monster.owned > 0) return 'partial'; // orange
            return 'none'; // rien
        };

        vm.stepIsEmptyOrComplete = function(step) {
            const monstersInStep = vm.steps[step] || [];
            const owned = monstersInStep.reduce((acc, monster) => acc + monster.owned, 0);

            return owned === 0 || vm.owned(false, false, step) === vm.total(false, false, step);
        };

        vm.zoneIsComplete = function(zone) {
            return vm.owned(false, zone) >= vm.total(false, zone);
        };

        vm.stepIsComplete = function(step) {
            return vm.owned(false, false, step) >= vm.total(false, false, step);
        };

        vm.resetAll = function() {
            if (confirm('Dernière chance !')) {
                locker.clean();

                vm.sorting = 0;
                vm.saveData = null;
                vm.displayOwnedMonsters = true;
                vm.displayFinishedZones = true;
                vm.displayFinishedSteps = true;
                vm.zones = {};
                vm.steps = [];
                vm.monsters = [];

                $('#saveModal').modal('hide');
            }
        };

        $http.get('monsters.json').then(function(res) {
            vm.monsters = res.data.filter(monster => monster.type === 'boss' || monster.type === 'archi');
            
            vm.monsters.forEach(monster => {
                monster.owned = vm.saveData?.find(el => el[0] === monster.id) ? vm.saveData.find(el => el[0] === monster.id)[1] : 0
            })

            vm.zones = {};
            vm.steps = [];

            angular.forEach(vm.monsters, function(monster) {
                angular.forEach(monster.zones, function(zone) {
                    if (angular.isUndefined(vm.zones[zone])) {
                        vm.zones[zone] = [];
                    }

                    vm.zones[zone].push(monster);
                });

                if (angular.isUndefined(vm.steps[monster.step])) {
                    vm.steps[monster.step] = [];
                }

                vm.steps[monster.step].push(monster);
            });
        });
    }

    angular.module('app')
        .controller('AppCtrl', AppCtrl);

}());