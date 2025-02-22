'use strict';

const { Device } = require('homey');
const StateUtils = require('../../lib/state_utils');
const ACFeatures = require('../../lib/ToshibaACFeatures');
const Constants = require('../../lib/constants');

let acMode = '';
let swingMode = '';

class ACDevice extends Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.fixCapabilities();
    await this.initCapabilities();
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('ACDevice has been added');
    // determine the capabilities for this type of AC
    await ACFeatures.setCapabilities(this);
    // set starting values for the AC
    const state = await this.getStoreValue(Constants.StoredValueState);
    StateUtils.convertStateToCapabilities(this, state);
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('ACDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('ACDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('ACDevice has been deleted');
  }

  async fixCapabilities(){
     //fix capabilites that have been removed/added in a new version of the app
     if ( this.hasCapability("target_self_cleaning")){
       await this.removeCapability("target_self_cleaning")
     };
     if ( !this.hasCapability(Constants.CapabilitySelfCleaning)){
       await this.addCapability(Constants.CapabilitySelfCleaning);
     }
  }

  async initCapabilities() {
    // initialize the capability listeners
    acMode = await this.getStoreValue(Constants.StoredCapabilityTargetACMode);
    swingMode = await this.getStoreValue(Constants.StoredCapabilityTargetSwingMode);

    const capabilities = [Constants.CapabilityOnOff,
      Constants.CapabilityTargetTemperatureInside,
      Constants.CapabilityTargetFanMode,
      Constants.CapabilityTargetPowerMode,
      Constants.CapabilityTargetMeritA,
    ];
    // do not add if capabilities not added (yet)
    if (acMode) {
      capabilities.push(acMode);
    }
    if (swingMode) {
      capabilities.push(swingMode);
    }
    if (this.hasCapability(Constants.CapabilityTargetMeritB)) {
      capabilities.push(Constants.CapabilityTargetMeritB);
    }

    this.registerMultipleCapabilityListener(capabilities,
      async (capabilityValues, capabilityOptions) => {
        await this.updateCapabilities(capabilityValues);
      });
  }

  async updateCapabilities(capabilityValues) {
    let onoffChanged = this.getCapabilityValue(Constants.CapabilityOnOff);
    for (const [key, value] of Object.entries(capabilityValues)) {
      await this.setCapabilityValue(key, value);
      onoffChanged = onoffChanged || (key === Constants.CapabilityOnOff);
    }
    await this.updateStateAfterUpdateCapability(onoffChanged);
  }

  async updateStateAfterUpdateCapability(onoffChanged) {
    const state = StateUtils.convertCapabilitiesToState(this);
    await this.setStoreValue(Constants.StoredValueState, state);

    // only send message when airco is turned on or OnOff capability changed
    if (onoffChanged) {
      this.driver.amqpAPI.sendMessage(state, this.getData().DeviceUniqueID);
    }
  }

  updateStateAfterHeartBeat(insideTemperature, outsideTemperature) {
    StateUtils.setOutsideTemperature(this, outsideTemperature);
    StateUtils.setInsideTemperature(this, insideTemperature);
  }

  updateState(state) {
    const currentState = this.getStoreValue(Constants.StoredValueState);
    if (currentState !== state) {
      this.setStoreValue(Constants.StoredValueState, state);
      StateUtils.convertStateToCapabilities(this, state);
    }
  }

  getResult(results, query) {
    // filter based on the query
    return results.filter(result => {
      return result.name.toLowerCase().includes(query.toLowerCase());
    });
  }

}
module.exports = ACDevice;
